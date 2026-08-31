import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Member } from '../../common/interfaces/member.interface';
import { MembersService } from '../../common/services/members.service';
import { SondageService, SurveyAnswer, SurveyItem } from './sondage.service';
import { SurveyOptionDefinition, SurveyQuestionDefinition } from '../../common/survey/survey-flow';

export type QuestionResult = SurveyQuestionDefinition;

export interface ResponseRow {
  id: string;
  memberName: string;
  firstName: string;
  lastName: string;
  memberEmail: string;
  memberId: string;
  isMember: boolean;
  createdAt: string;
  updatedAt: string;
  answers: Record<string, SurveyAnswer>;
  paymentStatus: 'notApplicable' | 'payable';
  paymentProductId?: string;
  requiresReconfirmation: boolean;
}

export interface SurveyReservation {
  memberId: string;
  memberName: string;
  isMember: boolean;
  expectedProductId?: string;
}

@Injectable({ providedIn: 'root' })
export class SurveyResultsService {

  constructor(
    private sondageService: SondageService,
    private membersService: MembersService,
  ) {}

  // ── Parsing brut ──────────────────────────────────────────────────────────

  normalizeAnswer(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  parseMemberName(memberName: string): { firstName: string; lastName: string } {
    const parts = (memberName ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  mapRawResponses(raw: any[]): ResponseRow[] {
    return raw.map((r: any) => {
      const memberName = r.memberName?.trim() || r.memberEmail;
      const { firstName, lastName } = this.parseMemberName(memberName);
      let answers = r.answers;
      if (typeof answers === 'string') answers = JSON.parse(answers);
      if (typeof answers === 'string') answers = JSON.parse(answers);
      return {
        id: r.id,
        memberName,
        firstName,
        lastName,
        memberEmail: r.memberEmail,
        memberId: r.memberId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt ?? r.submittedAt,
        answers: answers ?? {},
        paymentStatus: r.paymentStatus ?? 'notApplicable',
        paymentProductId: r.paymentProductId ?? undefined,
        requiresReconfirmation: r.requiresReconfirmation === true,
        isMember: r.memberId !== r.memberEmail,
      };
    });
  }

  getAnswerIndex(question: QuestionResult, answer: SurveyAnswer | undefined): number {
    if (!answer) return -1;
    return question.options.findIndex(option => option.value === answer.optionValue);
  }

  getAnswerLabel(question: QuestionResult, answer: SurveyAnswer | undefined): string {
    const label = this.getAnswerChoiceLabel(question, answer);
    const detailLabel = this.getAnswerDetailLabel(question, answer);
    return detailLabel === '—' ? label : `${label} : ${detailLabel}`;
  }

  getAnswerChoiceLabel(question: QuestionResult, answer: SurveyAnswer | undefined): string {
    const index = this.getAnswerIndex(question, answer);
    if (index < 0) return '—';
    const option: SurveyOptionDefinition | undefined = question.options[index];
    return option?.keyword?.trim() || option?.label || '—';
  }

  getAnswerDetailLabel(question: QuestionResult, answer: SurveyAnswer | undefined): string {
    if (!answer?.detailValue) return '—';
    const option = question.options.find(candidate => candidate.value === answer.optionValue);
    return option?.detailOptions?.find(detail => detail.value === answer.detailValue)?.label ?? '—';
  }

  // ── Affichage nom ─────────────────────────────────────────────────────────

  getResponseFullName(row: ResponseRow, members: Member[]): string {
    const member = members.find(m => m.id === row.memberId);
    if (member) return this.membersService.full_name(member);
    const lastName = (row.lastName || '').toUpperCase();
    const firstName = row.firstName || '';
    return (lastName + ' ' + firstName).trim() || row.memberName;
  }

  // ── Point d'entrée pour ticketing ─────────────────────────────────────────

  async getReservationsFromSurvey(surveyId: string): Promise<SurveyReservation[]> {
    const [rs, members] = await Promise.all([
      this.sondageService.listResponsesForSurvey(surveyId),
      firstValueFrom(this.membersService.listMembers()),
    ]);
    const rows = this.mapRawResponses(rs as any[]);

    return rows
      .filter(row => row.paymentStatus === 'payable' && !row.requiresReconfirmation)
      .map(row => ({
        memberId: row.memberId,
        memberName: this.getResponseFullName(row, members),
        isMember: row.isMember,
        expectedProductId: row.paymentProductId,
      }));
  }

  /** Charge la liste des sondages, triés par date décroissante. */
  async listSurveys(): Promise<SurveyItem[]> {
    return this.sondageService.listSurveys();
  }
}
