import { Injectable } from '@angular/core';
import { get, post, patch } from 'aws-amplify/api';
import { SurveyAnswers, SurveyQuestionDefinition } from '../../common/survey/survey-flow';

const API_NAME = 'ffbProxyApi';
const SURVEY_RESPOND_PATH = '/api/survey/respond';
export type { SurveyAnswer } from '../../common/survey/survey-flow';

export interface SurveyRespondData {
  token: string;
  memberId: string;
  memberName: string;
  survey: {
    id: string;
    title: string;
    description?: string;
    status?: 'draft' | 'active' | 'closed';
    closingDate?: string;
    footerNote?: string;
  };
  questions: SurveyQuestionDefinition[];
  existingResponse: {
    id: string;
    answers: SurveyAnswers;
    status: string;
    submittedAt: string;
    requiresReconfirmation?: boolean;
  } | null;
  aggregatedResults?: Record<string, number[]>;
  totalRespondents?: number;
}

@Injectable({ providedIn: 'root' })
export class SurveyRespondService {

  async load(token: string): Promise<SurveyRespondData> {
    const restOperation = get({
      apiName: API_NAME,
      path: SURVEY_RESPOND_PATH,
      options: {
        queryParams: { token },
      },
    });
    const { body } = await restOperation.response;
    const json = await body.json() as unknown;
    if ((json as any)?.error) throw new Error((json as any).error ?? 'HTTP error');
    return json as SurveyRespondData;
  }

  async submit(token: string, answers: SurveyAnswers): Promise<void> {
    const restOperation = post({
      apiName: API_NAME,
      path: SURVEY_RESPOND_PATH,
      options: {
        body: { token, answers } as any,
        headers: { 'Content-Type': 'application/json' },
      },
    });
    const { body } = await restOperation.response;
    const json = await body.json() as unknown;
    if ((json as any)?.error) throw new Error((json as any).error ?? 'HTTP error');
  }

  async updateStatus(token: string, status: 'confirmed' | 'declined' | 'cancelled' | 'submitted'): Promise<void> {
    const restOperation = patch({
      apiName: API_NAME,
      path: SURVEY_RESPOND_PATH,
      options: {
        body: { token, status } as any,
        headers: { 'Content-Type': 'application/json' },
      },
    });
    const { body } = await restOperation.response;
    const json = await body.json() as unknown;
    if ((json as any)?.error) throw new Error((json as any).error ?? 'HTTP error');
  }
}
