import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Member } from '../../common/interfaces/member.interface';
import { MembersService } from '../../common/services/members.service';
import { SondageService, SurveyItem } from './sondage.service';

export interface QuestionResult {
  id: string;
  order: number;
  text: string;
  options: string[];
  optionKeywords: string[];
}

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
  answers: Record<string, number>;
}

export interface SurveyReservation {
  memberName: string;
  isMember: boolean;
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
        isMember: r.memberId !== r.memberEmail,
      };
    });
  }

  // ── Logique présence/absence ──────────────────────────────────────────────

  invitationQuestion(questions: QuestionResult[]): QuestionResult | null {
    return questions.find(q => q.order === -1) ?? null;
  }

  isAbsent(row: ResponseRow, questions: QuestionResult[]): boolean {
    const invQ = this.invitationQuestion(questions);
    if (!invQ) return false;

    const idx = row.answers[invQ.id];
    if (idx === undefined) return false;
    if (idx === 0) return true;

    const keyword = this.normalizeAnswer(invQ.optionKeywords[idx] ?? '');
    const optionText = this.normalizeAnswer(invQ.options[idx] ?? '');
    const value = keyword || optionText;

    return value === 'absent'
      || value === 'non'
      || value === 'no'
      || value.includes('ne viendrai pas')
      || value.includes('ne viens pas')
      || value.includes('declined')
      || value.includes('cancelled');
  }

  getDefaultPresentOptionIndex(questions: QuestionResult[]): number {
    const invQ = this.invitationQuestion(questions);
    if (!invQ) return 1;
    for (let i = 1; i < invQ.options.length; i++) {
      const keyword = this.normalizeAnswer(invQ.optionKeywords[i] ?? '');
      const optionText = this.normalizeAnswer(invQ.options[i] ?? '');
      const value = keyword || optionText;
      if (!['absent', 'non', 'no'].includes(value)
        && !value.includes('ne viendrai pas')
        && !value.includes('ne viens pas')) {
        return i;
      }
    }
    return 1;
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

  /**
   * Charge le sondage et retourne la liste des réservations (présents uniquement).
   * Pour un sondage RSVP, seuls les répondants non absents sont inclus.
   * Pour un sondage sans question d'invitation, tous les répondants sont inclus.
   */
  async getReservationsFromSurvey(surveyId: string): Promise<SurveyReservation[]> {
    const [qs, rs, members] = await Promise.all([
      this.sondageService.listQuestionsForSurvey(surveyId),
      this.sondageService.listResponsesForSurvey(surveyId),
      firstValueFrom(this.membersService.listMembers()),
    ]);

    const questions: QuestionResult[] = (qs as any[]).map((q: any) => ({
      id: q.id,
      order: q.order,
      text: q.text,
      options: q.options ?? [],
      optionKeywords: q.optionKeywords ?? [],
    }));

    const rows = this.mapRawResponses(rs as any[]);

    return rows
      .filter(row => !this.isAbsent(row, questions))
      .map(row => ({
        memberName: this.getResponseFullName(row, members),
        isMember: row.isMember,
      }));
  }

  /** Charge la liste des sondages, triés par date décroissante. */
  async listSurveys(): Promise<SurveyItem[]> {
    return this.sondageService.listSurveys();
  }
}
