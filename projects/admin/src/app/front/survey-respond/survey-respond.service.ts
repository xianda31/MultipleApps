import { Injectable } from '@angular/core';
import { get, post, patch } from 'aws-amplify/api';

const API_NAME = 'ffbProxyApi';
const SURVEY_RESPOND_PATH = '/api/survey/respond';

export interface SurveyRespondData {
  token: string;
  memberId: string;
  memberName: string;
  survey: {
    id: string;
    title: string;
    description?: string;
    surveyType: 'poll' | 'rsvp' | 'invitation';
    status?: 'draft' | 'active' | 'closed';
    closingDate?: string;
    footerNote?: string;
  };
  questions: Array<{ id: string; text: string; options: string[]; optionKeywords: string[]; order: number }>;
  existingResponse: {
    id: string;
    answers: Record<string, number>;
    status: string;
    submittedAt: string;
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

  async submit(token: string, answers: Record<string, number>): Promise<void> {
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
