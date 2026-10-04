import { SondageService } from './sondage.service';

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