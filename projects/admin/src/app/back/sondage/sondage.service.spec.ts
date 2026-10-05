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