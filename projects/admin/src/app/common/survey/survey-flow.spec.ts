import {
  getReachableQuestions,
  hasPaymentTag,
  isSurveyPathComplete,
  requiresSurveyReconfirmation,
  sanitizeSurveyAnswers,
  SurveyQuestionDefinition,
  validatePaymentTag,
} from './survey-flow';

describe('survey flow', () => {
  const questions: SurveyQuestionDefinition[] = [
    {
      id: 'attendance', order: 0, text: 'Participez-vous ?',
      options: [
        {
          value: 'yes', label: 'Oui', nextAction: 'NEXT', payTag: true,
          detailPrompt: 'Choisissez un mandataire',
          detailOptions: [{ value: 'member-1', label: 'DUPONT Jean' }],
          detailOptionsOrigin: 'memberImport',
        },
        { value: 'no', label: 'Non', nextAction: 'END' },
      ],
    },
    {
      id: 'meal', order: 1, text: 'Menu',
      options: [
        { value: 'fish', label: 'Poisson', nextAction: 'NEXT' },
        { value: 'meat', label: 'Viande', nextAction: 'NEXT' },
      ],
    },
  ];

  it('stops at an END answer and discards unreachable answers', () => {
    const answers = { attendance: { optionValue: 'no' }, meal: { optionValue: 'fish' } };
    expect(getReachableQuestions(questions, answers).map(question => question.id)).toEqual(['attendance']);
    expect(sanitizeSurveyAnswers(questions, answers)).toEqual({ attendance: { optionValue: 'no' } });
    expect(isSurveyPathComplete(questions, answers)).toBeTrue();
    expect(hasPaymentTag(questions, answers)).toBeFalse();
  });

  it('continues on NEXT and detects the payment marker', () => {
    const answers = {
      attendance: { optionValue: 'yes', detailValue: 'member-1' },
      meal: { optionValue: 'fish' },
    };
    expect(getReachableQuestions(questions, answers).map(question => question.id)).toEqual(['attendance', 'meal']);
    expect(isSurveyPathComplete(questions, answers)).toBeTrue();
    expect(hasPaymentTag(questions, answers)).toBeTrue();
  });

  it('requires an answer to the current reachable question', () => {
    expect(getReachableQuestions(questions, { attendance: { optionValue: 'yes' } }).map(question => question.id))
      .toEqual(['attendance']);
    expect(isSurveyPathComplete(questions, { attendance: { optionValue: 'yes' } })).toBeFalse();
  });

  it('requires the detail list value before continuing', () => {
    expect(getReachableQuestions(questions, {
      attendance: { optionValue: 'yes', detailValue: 'member-1' },
    }).map(question => question.id))
      .toEqual(['attendance', 'meal']);
    expect(isSurveyPathComplete(questions, {
      attendance: { optionValue: 'yes', detailValue: 'member-1' },
    })).toBeFalse();
  });

  it('rejects more than one payment marker', () => {
    const duplicate = structuredClone(questions);
    duplicate[1].options[0].payTag = true;
    expect(validatePaymentTag(duplicate)).toBeFalse();
  });

  it('does not require reconfirmation for labels or unselected options', () => {
    const updated = structuredClone(questions);
    updated[0].text = 'Nouveau libellé';
    updated[0].options[0].label = 'Certainement';
    updated[0].options.push({ value: 'later', label: 'Plus tard', nextAction: 'END' });
    const answers = {
      attendance: { optionValue: 'yes', detailValue: 'member-1' },
      meal: { optionValue: 'fish' },
    };
    expect(requiresSurveyReconfirmation(questions, updated, answers)).toBeFalse();
  });

  it('requires reconfirmation when the selected path becomes incomplete', () => {
    const updated = structuredClone(questions);
    updated[0].options[0].detailOptions = [{ value: 'member-2', label: 'MARTIN Alice' }];
    const answers = {
      attendance: { optionValue: 'yes', detailValue: 'member-1' },
      meal: { optionValue: 'fish' },
    };
    expect(requiresSurveyReconfirmation(questions, updated, answers)).toBeTrue();
  });

  it('requires reconfirmation when the selected payment behavior changes', () => {
    const updated = structuredClone(questions);
    updated[0].options[0].payTag = false;
    const answers = {
      attendance: { optionValue: 'yes', detailValue: 'member-1' },
      meal: { optionValue: 'fish' },
    };
    expect(requiresSurveyReconfirmation(questions, updated, answers)).toBeTrue();
  });
});