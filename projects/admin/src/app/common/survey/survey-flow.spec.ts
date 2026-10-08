import {
  getReachableQuestions,
  hasPaymentTag,
  isSurveyPathComplete,
  normalizeSurveyComment,
  requiresSurveyReconfirmation,
  sanitizeSurveyAnswers,
  SURVEY_COMMENT_MAX_LENGTH,
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

  describe('commentaire libre facultatif', () => {
    const commented: SurveyQuestionDefinition[] = [
      {
        id: 'taste', order: 0, text: 'Votre avis ?',
        commentResultLabel: 'Précision',
        options: [
          { value: 'love', label: "J'aime trop", nextAction: 'END' },
          {
            value: 'mixed', label: "J'aime mais…", nextAction: 'END',
            commentEnabled: true, commentPrompt: 'Dites-nous ce qui vous a gêné',
          },
        ],
      },
    ];

    it('considers an answer complete without any comment', () => {
      expect(isSurveyPathComplete(commented, { taste: { optionValue: 'mixed' } })).toBeTrue();
    });

    it('keeps and trims a comment on an option that accepts it', () => {
      expect(sanitizeSurveyAnswers(commented, {
        taste: { optionValue: 'mixed', comment: '  en violet, plus joli  ' },
      })).toEqual({ taste: { optionValue: 'mixed', comment: 'en violet, plus joli' } });
    });

    it('drops a comment carried by an option that does not accept one', () => {
      expect(sanitizeSurveyAnswers(commented, {
        taste: { optionValue: 'love', comment: 'commentaire orphelin' },
      })).toEqual({ taste: { optionValue: 'love' } });
    });

    it('drops a blank comment instead of storing an empty string', () => {
      expect(sanitizeSurveyAnswers(commented, {
        taste: { optionValue: 'mixed', comment: '   ' },
      })).toEqual({ taste: { optionValue: 'mixed' } });
    });

    it('caps the stored comment length', () => {
      const long = 'a'.repeat(SURVEY_COMMENT_MAX_LENGTH + 50);
      expect(normalizeSurveyComment(long)?.length).toBe(SURVEY_COMMENT_MAX_LENGTH);
      expect(normalizeSurveyComment('   ')).toBeUndefined();
      expect(normalizeSurveyComment(undefined)).toBeUndefined();
    });

    it('does not ask respondents to reconfirm when a comment box is added or removed', () => {
      const withoutComment = structuredClone(commented);
      withoutComment[0].options[1].commentEnabled = false;
      const answers = { taste: { optionValue: 'mixed', comment: 'en violet' } };

      expect(requiresSurveyReconfirmation(commented, withoutComment, answers)).toBeFalse();
      expect(requiresSurveyReconfirmation(withoutComment, commented, answers)).toBeFalse();
    });
  });
});