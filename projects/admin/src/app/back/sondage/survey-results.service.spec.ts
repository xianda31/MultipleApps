import { of } from 'rxjs';
import { QuestionResult, SurveyResultsService } from './survey-results.service';

describe('SurveyResultsService answers', () => {
  const service = new SurveyResultsService(null as any, null as any);

  const radioQuestion: QuestionResult = {
    id: 'radio',
    order: 0,
    text: 'Choix',
    options: [
      { value: 'yes', label: 'Oui', keyword: 'O', nextAction: 'NEXT' },
      { value: 'no', label: 'Non', keyword: 'N', nextAction: 'END' },
    ],
  };

  const selectQuestion: QuestionResult = {
    id: 'select',
    order: 1,
    text: 'Mandataire',
    options: [
      { value: 'member-1', label: 'DUPONT Jean', nextAction: 'NEXT' },
      { value: 'member-2', label: 'MARTIN Alice', nextAction: 'NEXT' },
    ],
  };

  const detailQuestion: QuestionResult = {
    id: 'proxy',
    order: 2,
    text: 'Votre choix',
    options: [{
      value: 'proxy',
      label: 'Je donne pouvoir à',
      nextAction: 'END',
      detailOptions: [{ value: 'member-1', label: 'DUPONT Jean' }],
      detailOptionsOrigin: 'memberImport',
    }],
  };

  it('resolves a radio answer by its stable value', () => {
    expect(service.getAnswerIndex(radioQuestion, { optionValue: 'no' })).toBe(1);
    expect(service.getAnswerLabel(radioQuestion, { optionValue: 'no' })).toBe('N');
  });

  it('resolves a select answer by its stable value', () => {
    expect(service.getAnswerIndex(selectQuestion, { optionValue: 'member-2' })).toBe(1);
    expect(service.getAnswerLabel(selectQuestion, { optionValue: 'member-2' })).toBe('MARTIN Alice');
  });

  it('rejects an unknown select value', () => {
    expect(service.getAnswerIndex(selectQuestion, { optionValue: 'unknown' })).toBe(-1);
    expect(service.getAnswerLabel(selectQuestion, { optionValue: 'unknown' })).toBe('—');
  });

  it('includes the selected detail in the displayed answer', () => {
    const answer = { optionValue: 'proxy', detailValue: 'member-1' };
    expect(service.getAnswerChoiceLabel(detailQuestion, answer)).toBe('Je donne pouvoir à');
    expect(service.getAnswerDetailLabel(detailQuestion, answer)).toBe('DUPONT Jean');
    expect(service.getAnswerLabel(detailQuestion, answer)).toBe('Je donne pouvoir à : DUPONT Jean');
  });

  it('maps the reconfirmation marker from a stored response', () => {
    const [row] = service.mapRawResponses([{
      id: 'response-1', memberName: 'Jean Dupont', memberEmail: 'jean@example.com', memberId: 'member-1',
      answers: '{}', paymentStatus: 'notApplicable', requiresReconfirmation: true,
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    }]);
    expect(row.requiresReconfirmation).toBeTrue();
  });
});

describe('SurveyResultsService reservations for ticketing', () => {
  const response = (overrides: Record<string, unknown>) => ({
    surveyId: 'noel', answers: '{}', paymentStatus: 'payable', paymentProductId: 'product-noel',
    requiresReconfirmation: false, createdAt: '2026-11-20', updatedAt: '2026-11-20',
    ...overrides,
  });

  function setup(responses: Record<string, unknown>[]) {
    const sondage = jasmine.createSpyObj('SondageService', ['listResponsesForSurvey']);
    sondage.listResponsesForSurvey.and.resolveTo(responses);
    const members = jasmine.createSpyObj('MembersService', ['listMembers', 'full_name']);
    members.listMembers.and.returnValue(of([
      { id: 'member-anne', firstname: 'Anne', lastname: 'Dupont' },
      { id: 'member-jean', firstname: 'Jean', lastname: 'Dupont' },
    ]));
    members.full_name.and.callFake((member: { firstname: string; lastname: string }) =>
      `${member.lastname.toUpperCase()} ${member.firstname}`);
    return { service: new SurveyResultsService(sondage, members), sondage };
  }

  it('books each member who answered with the paying option, with the survey product', async () => {
    const { service, sondage } = setup([
      response({ id: 'r1', memberId: 'member-anne', memberEmail: 'anne@example.com', memberName: 'Anne Dupont' }),
      response({ id: 'r2', memberId: 'member-jean', memberEmail: 'jean@example.com', memberName: 'Jean Dupont' }),
    ]);

    const reservations = await service.getReservationsFromSurvey('noel');

    expect(sondage.listResponsesForSurvey).toHaveBeenCalledOnceWith('noel');
    expect(reservations).toEqual([
      { memberId: 'member-anne', memberName: 'DUPONT Anne', isMember: true, expectedProductId: 'product-noel' },
      { memberId: 'member-jean', memberName: 'DUPONT Jean', isMember: true, expectedProductId: 'product-noel' },
    ]);
  });

  it('ignores declined answers and answers awaiting reconfirmation', async () => {
    const { service } = setup([
      response({ id: 'r1', memberId: 'member-anne', memberEmail: 'anne@example.com' }),
      response({ id: 'r2', memberId: 'member-jean', memberEmail: 'jean@example.com',
        paymentStatus: 'notApplicable', paymentProductId: null }),
      response({ id: 'r3', memberId: 'member-paul', memberEmail: 'paul@example.com', requiresReconfirmation: true }),
    ]);

    const reservations = await service.getReservationsFromSurvey('noel');

    expect(reservations.map(row => row.memberId)).toEqual(['member-anne']);
  });

  it('treats an external recipient, identified by email, as a non-member', async () => {
    const { service } = setup([
      response({ id: 'r1', memberId: 'guest@example.com', memberEmail: 'guest@example.com', memberName: 'Claire Invitée' }),
    ]);

    const [reservation] = await service.getReservationsFromSurvey('noel');

    expect(reservation).toEqual(jasmine.objectContaining({ isMember: false, memberName: 'INVITÉE Claire' }));
  });
});