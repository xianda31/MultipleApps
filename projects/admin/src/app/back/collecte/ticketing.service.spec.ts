import {
  ReservationImportRow, TicketingPayment, TicketingReservation, TicketingService,
} from './ticketing.service';

type Row = Record<string, any> & { id: string };

/** Table Amplify simulée en mémoire : list / create / update. */
class FakeTable<T extends Row> {
  readonly rows: T[] = [];
  private sequence = 0;

  constructor(private readonly prefix: string) {}

  list = jasmine.createSpy('list').and.callFake(async () => ({ data: this.rows.map(row => ({ ...row })) }));

  create = jasmine.createSpy('create').and.callFake(async (input: Partial<T>) => {
    const row = { ...input, id: `${this.prefix}-${++this.sequence}` } as T;
    this.rows.push(row);
    return { data: { ...row } };
  });

  update = jasmine.createSpy('update').and.callFake(async (input: Partial<T> & { id: string }) => {
    const row = this.rows.find(candidate => candidate.id === input.id);
    if (!row) return { data: null, errors: [{ message: 'not found' }] };
    Object.assign(row, input);
    return { data: { ...row } };
  });

  get(id: string): T {
    return this.rows.find(row => row.id === id)!;
  }
}

describe('TicketingService', () => {
  const ctx = { date: '2026-12-18', season: '2026/27', eventTitle: 'Repas de Noël' };
  const dinner = 'product-noel';
  let service: TicketingService;
  let reservations: FakeTable<TicketingReservation & Row>;
  let payments: FakeTable<TicketingPayment & Row>;

  const couple: ReservationImportRow[] = [
    { memberId: 'member-anne', memberName: 'DUPONT Anne', isMember: true, expectedProductId: dinner },
    { memberId: 'member-jean', memberName: 'DUPONT Jean', isMember: true, expectedProductId: dinner },
  ];

  function reservationOf(memberId: string): TicketingReservation & Row {
    return reservations.rows.find(row => row.memberId === memberId)!;
  }

  /** Reproduit l'encaissement groupé de la billetterie (validateMiniCart). */
  async function sell(memberIds: string[], paymentMode: 'cash' | 'cheque' | 'card' = 'cheque', price = 35) {
    const selected = memberIds.map(reservationOf);
    const payment = await service.createPayment({
      ...ctx, paymentMode, totalAmount: price * selected.length, reservationCount: selected.length,
    });
    await service.markReservationsSold({
      reservationIds: selected.map(row => row.id),
      paymentId: payment.id,
      paymentMode,
      paidByReservationId: Object.fromEntries(
        selected.map(row => [row.id, { amount: price, account: 'PAF', productId: dinner }]),
      ),
    });
    return payment;
  }

  beforeEach(() => {
    reservations = new FakeTable('reservation');
    payments = new FakeTable('payment');
    service = new TicketingService();
    spyOnProperty(TicketingService.prototype as any, 'models', 'get').and.returnValue({
      TicketingReservation: reservations,
      TicketingPayment: payments,
    });
  });

  describe('import from a survey', () => {
    it('creates one reserved booking per member with the survey product', async () => {
      const result = await service.importReservations(couple, { ...ctx, source: 'survey:noel' });

      expect(result).toEqual({ created: 2, updated: 0 });
      expect(reservationOf('member-anne')).toEqual(jasmine.objectContaining({
        reservationKey: 'member:member-anne', reservationStatus: 'reserved', isMember: true,
        expectedProductId: dinner, eventTitle: 'Repas de Noël', date: ctx.date, season: ctx.season,
        source: 'survey:noel',
      }));
    });

    it('updates unpaid bookings on re-import instead of duplicating them', async () => {
      await service.importReservations(couple, ctx);
      const result = await service.importReservations(
        [{ ...couple[0], memberName: 'DUPONT-MARTIN Anne' }, couple[1]], ctx,
      );

      expect(result).toEqual({ created: 0, updated: 2 });
      expect(reservations.rows.length).toBe(2);
      expect(reservationOf('member-anne').memberName).toBe('DUPONT-MARTIN Anne');
    });

    it('never alters a booking that has already been paid', async () => {
      await service.importReservations(couple, ctx);
      await sell(['member-anne']);
      const paid = { ...reservationOf('member-anne') };

      const result = await service.importReservations(
        couple.map(row => ({ ...row, expectedProductId: 'other-product' })), ctx,
      );

      expect(result).toEqual({ created: 0, updated: 1 });
      expect(reservationOf('member-anne')).toEqual(paid);
      expect(reservationOf('member-jean').expectedProductId).toBe('other-product');
    });

    it('adds a late answer to the existing bookings of the event', async () => {
      await service.importReservations([couple[0]], ctx);
      const result = await service.importReservations(couple, ctx);

      expect(result).toEqual({ created: 1, updated: 1 });
      expect(reservations.rows.map(row => row.memberId).sort()).toEqual(['member-anne', 'member-jean']);
    });
  });

  describe('grouped payment for a couple', () => {
    it('links both bookings to a single payment with their own price', async () => {
      await service.importReservations(couple, ctx);

      const payment = await sell(['member-anne', 'member-jean'], 'card');

      expect(payments.get(payment.id)).toEqual(jasmine.objectContaining({
        status: 'active', paymentMode: 'card', totalAmount: 70, reservationCount: 2,
      }));
      for (const memberId of ['member-anne', 'member-jean']) {
        expect(reservationOf(memberId)).toEqual(jasmine.objectContaining({
          reservationStatus: 'sold', paymentId: payment.id, paymentMode: 'card',
          paidAmount: 35, paidAccount: 'PAF', paidProductId: dinner,
        }));
        expect(reservationOf(memberId).paidAt).toEqual(jasmine.any(String));
      }
    });

    it('cancels the whole group and makes both bookings payable again', async () => {
      await service.importReservations([...couple, { memberId: 'member-paul', memberName: 'MARTIN Paul', isMember: true }], ctx);
      const couplePayment = await sell(['member-anne', 'member-jean']);
      const otherPayment = await sell(['member-paul'], 'cash');

      await service.cancelPayment(payments.get(couplePayment.id));

      expect(payments.get(couplePayment.id).status).toBe('cancelled');
      for (const memberId of ['member-anne', 'member-jean']) {
        expect(reservationOf(memberId)).toEqual(jasmine.objectContaining({
          reservationStatus: 'reserved', paymentId: null, paymentMode: null, paidAmount: null, paidAt: null,
        }));
      }
      expect(reservationOf('member-paul')).toEqual(jasmine.objectContaining({
        reservationStatus: 'sold', paymentId: otherPayment.id,
      }));
      expect(payments.get(otherPayment.id).status).toBe('active');
    });

    it('refuses to cancel a payment that has been accounted', async () => {
      await service.importReservations(couple, ctx);
      const payment = await sell(['member-anne', 'member-jean']);
      await service.markAccounted({
        reservationIds: reservations.rows.map(row => row.id), paymentIds: [payment.id],
      });

      await expectAsync(service.cancelPayment(payments.get(payment.id)))
        .toBeRejectedWithError(/déjà comptabilisé/);
      expect(reservationOf('member-anne').reservationStatus).toBe('sold');
      expect(payments.get(payment.id).status).toBe('active');
    });

    it('ignores a second cancellation of the same payment', async () => {
      await service.importReservations(couple, ctx);
      const payment = await sell(['member-anne', 'member-jean']);
      await service.cancelPayment(payments.get(payment.id));
      reservations.update.calls.reset();

      await service.cancelPayment(payments.get(payment.id));

      expect(reservations.update).not.toHaveBeenCalled();
    });
  });

  it('marks bookings and payments as accounted at the same time', async () => {
    await service.importReservations(couple, ctx);
    const payment = await sell(['member-anne', 'member-jean']);

    await service.markAccounted({ reservationIds: reservations.rows.map(row => row.id), paymentIds: [payment.id] });

    const accountedAt = payments.get(payment.id).accountedAt;
    expect(accountedAt).toEqual(jasmine.any(String));
    expect(reservations.rows.every(row => row.accountedAt === accountedAt)).toBeTrue();
  });

  it('lists only the bookings and payments of the requested event and date', async () => {
    await service.importReservations(couple, ctx);
    await service.importReservations([couple[0]], { ...ctx, eventTitle: 'Galette des rois' });
    await service.importReservations([couple[0]], { ...ctx, date: '2026-12-19' });
    await sell(['member-jean']);

    const listed = await service.listReservations(ctx.date, '  repas de noël ');
    const listedPayments = await service.listPayments(ctx.date, 'REPAS DE NOËL');

    expect(listed.map(row => row.memberId).sort()).toEqual(['member-anne', 'member-jean']);
    expect(listedPayments.length).toBe(1);
  });

  it('identifies members by id and guests by their normalised name', () => {
    expect(service.buildReservationKey('DUPONT Anne', 'member-anne')).toBe('member:member-anne');
    expect(service.buildReservationKey('  Éloïse   Bérard ')).toBe('eloise berard');
    expect(service.buildReservationKey('ELOISE BERARD')).toBe(service.buildReservationKey('Éloïse Bérard'));
  });
});
