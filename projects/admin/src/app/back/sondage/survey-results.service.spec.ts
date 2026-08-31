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