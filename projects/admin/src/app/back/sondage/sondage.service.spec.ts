import { SondageService } from './sondage.service';

describe('SondageService listing', () => {
  it('sorts surveys by descending closing date', async () => {
    const service = new SondageService();
    spyOnProperty(service as any, 'm', 'get').and.returnValue({
      Survey: {
        list: jasmine.createSpy('listSurveys').and.resolveTo({
          data: [
            { id: 'middle', closingDate: '2026-10-15' },
            { id: 'latest', closingDate: '2026-11-30' },
            { id: 'earliest', closingDate: '2026-09-01' },
          ],
        }),
      },
    });

    const surveys = await service.listSurveys();

    expect(surveys.map(survey => survey.id)).toEqual(['latest', 'middle', 'earliest']);
  });
});

describe('SondageService mutations', () => {
  it('returns the created survey when Amplify succeeds', async () => {
    const service = new SondageService();
    spyOnProperty(service as any, 'm', 'get').and.returnValue({
      Survey: {
        create: jasmine.createSpy('createSurvey').and.resolveTo({
          data: { id: 'survey-1', title: 'Sondage' },
        }),
      },
    });

    const survey = await service.createSurvey({
      title: 'Sondage',
      closingDate: '2026-10-31',
    });

    expect(survey.id).toBe('survey-1');
  });

  it('surfaces the Amplify error instead of returning a null survey', async () => {
    const service = new SondageService();
    spyOnProperty(service as any, 'm', 'get').and.returnValue({
      Survey: {
        create: jasmine.createSpy('createSurvey').and.resolveTo({
          data: null,
          errors: [{ message: 'Not authorized to access createSurvey' }],
        }),
      },
    });

    await expectAsync(service.createSurvey({
      title: 'Sondage',
      closingDate: '2026-10-31',
    })).toBeRejectedWithError(
      'Création du sondage impossible : Not authorized to access createSurvey',
    );
  });

  it('rejects a null mutation result even when Amplify provides no error details', async () => {
    const service = new SondageService();
    spyOnProperty(service as any, 'm', 'get').and.returnValue({
      SurveyQuestion: {
        create: jasmine.createSpy('createQuestion').and.resolveTo({ data: null }),
      },
    });

    await expectAsync(service.createQuestion({
      surveyId: 'survey-1',
      text: 'Question',
      options: [],
      order: 0,
    })).toBeRejectedWithError(
      'Création de la question impossible : aucune donnée retournée par Amplify',
    );
  });

  it('surfaces an Amplify update error', async () => {
    const service = new SondageService();
    spyOnProperty(service as any, 'm', 'get').and.returnValue({
      SurveyQuestion: {
        update: jasmine.createSpy('updateQuestion').and.resolveTo({
          data: null,
          errors: [{ message: 'Unknown field commentEnabled' }],
        }),
      },
    });

    await expectAsync(service.updateQuestion('question-1', {
      options: [],
    })).toBeRejectedWithError(
      'Mise à jour de la question impossible : Unknown field commentEnabled',
    );
  });
});

describe('SondageService deletion', () => {
  it('deletes related questions, responses and tokens with the survey', async () => {
    const surveyId = 'survey-1';
    const models = {
      Survey: { delete: jasmine.createSpy('deleteSurvey').and.resolveTo({}) },
      SurveyQuestion: {
        list: jasmine.createSpy('listQuestions').and.resolveTo({
          data: [{ id: 'question-1', surveyId }],
          nextToken: null,
        }),
        delete: jasmine.createSpy('deleteQuestion').and.resolveTo({}),
      },
      SurveyResponse: {
        list: jasmine.createSpy('listResponses').and.resolveTo({
          data: [{ id: 'response-1', surveyId }],
          nextToken: null,
        }),
        delete: jasmine.createSpy('deleteResponse').and.resolveTo({}),
      },
      SurveyToken: {
        list: jasmine.createSpy('listTokens').and.resolveTo({
          data: [{ token: 'token-1', surveyId }],
          nextToken: null,
        }),
        delete: jasmine.createSpy('deleteToken').and.resolveTo({}),
      },
    };
    const service = new SondageService();
    spyOnProperty(service as any, 'm', 'get').and.returnValue(models);

    await service.deleteSurvey(surveyId);

    expect(models.SurveyQuestion.delete).toHaveBeenCalledOnceWith({ id: 'question-1' });
    expect(models.SurveyResponse.delete).toHaveBeenCalledOnceWith({ id: 'response-1' });
    expect(models.SurveyToken.delete).toHaveBeenCalledOnceWith({ token: 'token-1' });
    expect(models.Survey.delete).toHaveBeenCalledOnceWith({ id: surveyId });
  });
});