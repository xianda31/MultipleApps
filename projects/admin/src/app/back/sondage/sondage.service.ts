import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../../../amplify/data/resource';

export type SurveyItem = Schema['Survey']['type'];
export type SurveyQuestionItem = Schema['SurveyQuestion']['type'];
export type SurveyResponseItem = Schema['SurveyResponse']['type'];

export type SurveyStatus = 'draft' | 'active' | 'closed';
export type SurveyType = 'poll' | 'rsvp' | 'invitation';
export type ResponseStatus = 'submitted' | 'confirmed' | 'declined' | 'cancelled';

export interface SurveyInput {
  title: string;
  description?: string;
  footerNote?: string;
  surveyType?: SurveyType;
  closingDate: string;
  productTag?: string;
  status?: SurveyStatus;
}

export interface QuestionInput {
  surveyId: string;
  text: string;
  options: string[];
  optionKeywords?: string[];
  order: number;
}

@Injectable({ providedIn: 'root' })
export class SondageService {
  private get m() {
    return generateClient<Schema>().models as any;
  }

  // ── Survey ─────────────────────────────────────────────────────────────────

  async listSurveys(): Promise<SurveyItem[]> {
    const { data } = await this.m.Survey.list({});
    return (data ?? []).sort((a: any, b: any) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    );
  }

  async getSurvey(id: string): Promise<SurveyItem | null> {
    const { data } = await this.m.Survey.get({ id });
    return data ?? null;
  }

  async createSurvey(input: SurveyInput): Promise<SurveyItem> {
    const { data } = await this.m.Survey.create({ ...input, status: input.status ?? 'active' });
    return data;
  }

  async updateSurvey(id: string, input: Partial<SurveyInput>): Promise<void> {
    await this.m.Survey.update({ id, ...input });
  }

  async updateSurveyStatus(id: string, status: SurveyStatus): Promise<void> {
    await this.m.Survey.update({ id, status });
  }

  async deleteSurvey(id: string): Promise<void> {
    await this.m.Survey.delete({ id });
  }

  // ── Questions ──────────────────────────────────────────────────────────────

  async listQuestionsForSurvey(surveyId: string): Promise<SurveyQuestionItem[]> {
    const { data } = await this.m.SurveyQuestion.list({});
    return ((data ?? []) as any[])
      .filter((q: any) => q != null && q.surveyId === surveyId)
      .sort((a: any, b: any) => a.order - b.order);
  }

  async createQuestion(input: QuestionInput): Promise<SurveyQuestionItem> {
    const { data } = await this.m.SurveyQuestion.create(input);
    return data;
  }

  async updateQuestion(id: string, input: Partial<QuestionInput>): Promise<void> {
    await this.m.SurveyQuestion.update({ id, ...input });
  }

  // ── Email body builder (partagé mailing + éditeur) ────────────────────────

  buildSurveyEmailBody(survey: SurveyItem, questions: SurveyQuestionItem[]): string {
    const closingFmt = survey.closingDate
      ? new Date(survey.closingDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'date de clôture';

    const surveyType = (survey as any).surveyType ?? 'poll';
    const isRsvp = surveyType === 'rsvp';
    const questionCount = questions.filter(q => (q.text as string)?.trim()).length;
    const footerNote = (survey as any).footerNote?.trim();

    const ctaLabel = isRsvp ? 'Répondre à l\'invitation' : 'Accéder au sondage';
    const questionHint = !isRsvp && questionCount > 0
      ? `<p style="color:#777;font-size:14px;margin:0 0 28px 0">Ce sondage comporte <strong>${questionCount} question${questionCount > 1 ? 's' : ''}</strong>.</p>`
      : '';

    return `
      <h2 style="color:#333;margin-top:0">${survey.title || 'Invitation'}</h2>
      ${survey.description ? `<p style="color:#555;line-height:1.6;margin-bottom:20px">${survey.description}</p>` : ''}
      ${questionHint}
      <div style="text-align:center;margin:32px 0">
        <a href="[SURVEY_LINK]" style="background-color:#667eea;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;display:inline-block">
          ${ctaLabel}
        </a>
      </div>
      <p style="color:#aaa;font-size:12px;margin-top:24px;text-align:center">
        Ce lien est personnel et nominatif — valable jusqu'au ${closingFmt}.<br>
        Ne le transmettez pas à un tiers.
      </p>
      ${footerNote ? `<p style="color:#555;font-size:13px;margin-top:16px;text-align:center">${footerNote}</p>` : ''}
    `;
  }

  // ── Responses ──────────────────────────────────────────────────────────────

  async listResponsesForSurvey(surveyId: string): Promise<SurveyResponseItem[]> {
    const { data } = await this.m.SurveyResponse.list({});
    return ((data ?? []) as any[])
      .filter((r: any) => r != null && r.surveyId === surveyId)
      .sort((a: any, b: any) => (a.memberName ?? '').localeCompare(b.memberName ?? ''));
  }

  async createManualResponse(input: {
    surveyId: string;
    memberId: string;
    memberEmail: string;
    memberName: string;
    answers: Record<string, number>;
    status?: string;
  }): Promise<SurveyResponseItem> {
    const { data } = await this.m.SurveyResponse.create({
      ...input,
      answers: JSON.stringify(input.answers),
      submittedAt: new Date().toISOString(),
      status: input.status ?? 'submitted',
    });
    return data;
  }

  async updateResponseAnswers(id: string, answers: Record<string, number>, status?: string): Promise<void> {
    await this.m.SurveyResponse.update({
      id,
      answers: JSON.stringify(answers),
      submittedAt: new Date().toISOString(),
      ...(status ? { status } : {}),
    });
  }

  async deleteResponse(id: string): Promise<void> {
    await this.m.SurveyResponse.delete({ id });
  }
}
