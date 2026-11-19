import { Member } from '../../common/interfaces/member.interface';
import { Product } from '../products/product.interface';
import { EventTicketGuardService } from './event-ticket-guard.service';

describe('EventTicketGuardService', () => {
  const dinner = { id: 'product-noel', name: 'Repas de Noël', fulfillmentAction: 'SETTLE_TICKETING_RESERVATION' } as Product;
  const anne = { id: 'member-anne', firstname: 'Anne', lastname: 'DUPONT' } as Member;
  const jean = { id: 'member-jean', firstname: 'Jean', lastname: 'DUPONT' } as Member;

  function setup(responses: Record<string, unknown>[], reservations: Record<string, unknown>[] = []) {
    const sondage = jasmine.createSpyObj('SondageService', ['listSurveys', 'listResponsesForSurvey']);
    sondage.listSurveys.and.resolveTo([
      { id: 'survey-noel', title: 'Repas de Noël', productTag: 'product-noel' },
      { id: 'survey-ag', title: 'AG', productTag: null },
    ]);
    sondage.listResponsesForSurvey.and.callFake(async (id: string) => id === 'survey-noel' ? responses : []);
    const ticketing = jasmine.createSpyObj('TicketingService', ['listEventReservations']);
    ticketing.listEventReservations.and.resolveTo(reservations);
    return new EventTicketGuardService(sondage, ticketing);
  }

  const coming = (memberId: string, overrides: Record<string, unknown> = {}) =>
    ({ memberId, paymentStatus: 'payable', requiresReconfirmation: false, ...overrides });

  it('allows a member who answered « je viens »', async () => {
    expect(await setup([coming('member-anne')]).refusalReason(dinner, [anne])).toBeNull();
  });

  it('refuses a member without answer, with a declined answer, or awaiting reconfirmation', async () => {
    const guard = setup([
      coming('member-jean', { paymentStatus: 'notApplicable' }),
      coming('member-anne', { requiresReconfirmation: true }),
    ]);

    expect(await guard.refusalReason(dinner, [anne])).toContain('DUPONT Anne n’a pas répondu « je viens » au sondage « Repas de Noël »');
    expect(await guard.refusalReason(dinner, [jean])).toContain('achat impossible');
  });

  it('requires both members of a couple product to have answered', async () => {
    const reason = await setup([coming('member-anne')]).refusalReason(dinner, [anne, jean]);

    expect(reason).toContain('DUPONT Jean');
  });

  it('refuses a second purchase once the reservation is paid', async () => {
    const reason = await setup([coming('member-anne')], [
      { reservationKey: 'member:member-anne', reservationStatus: 'sold' },
    ]).refusalReason(dinner, [anne]);

    expect(reason).toBe('DUPONT Anne a déjà réglé « Repas de Noël ».');
  });

  it('refuses the sale when no survey is attached to the product', async () => {
    const reason = await setup([]).refusalReason({ ...dinner, id: 'product-orphan', name: 'Galette' } as Product, [anne]);

    expect(reason).toContain('aucun sondage');
  });

  it('does not restrict products without the ticketing action', async () => {
    const guard = setup([]);

    expect(await guard.refusalReason({ ...dinner, fulfillmentAction: null } as Product, [anne])).toBeNull();
  });
});
