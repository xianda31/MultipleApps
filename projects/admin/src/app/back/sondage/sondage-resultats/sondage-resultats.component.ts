import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SondageService, SurveyAnswer } from '../sondage.service';
import { SurveyResultsService, QuestionResult, ResponseRow } from '../survey-results.service';
import { MembersService } from '../../../common/services/members.service';
import { Member } from '../../../common/interfaces/member.interface';
import { firstValueFrom } from 'rxjs';
import { BACK_ROUTE_ABS_PATHS } from '../../routes/back-route-paths';
import {
  getReachableQuestions,
  hasPaymentTag,
  isSurveyPathComplete,
  sanitizeSurveyAnswers,
} from '../../../common/survey/survey-flow';

@Component({
  selector: 'app-sondage-resultats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sondage-resultats.component.html',
})
export class SondageResultatsComponent implements OnInit {
  static readonly RESULT_COLUMN_TITLE_MAX_LENGTH = 15;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sondageService: SondageService,
    private surveyResults: SurveyResultsService,
    public membersService: MembersService,
  ) {}
  

  surveyId = '';
  surveyTitle = '';
  surveyProductId = '';
  questions: QuestionResult[] = [];
  responses: ResponseRow[] = [];
  members: Member[] = [];
  loading = true;

  // ── Vote manuel ────────────────────────────────────────────────────────────
  manualOpen = false;
  editingResponseId: string | null = null;   // null = nouveau vote
  manualMemberId = '';                        // m.id sélectionné (vide si externe)
  manualIsExternal = false;                   // true = saisie d'un externe
  manualExternalEmail = '';
  manualExternalFirstName = '';
  manualExternalLastName = '';
  manualAnswers: Record<string, SurveyAnswer> = {};
  savingManual = false;
  manualError: string | null = null;

  /** Membre déjà sélectionné → libellé dans la liste */
  alreadyVotedIds = new Set<string>();

  /** Membres triés : non-votants en premier, puis votants (en gris) */
  get sortedMembersForSelect(): Member[] {
    return [...this.members].sort((a, b) => {
      const av = this.alreadyVotedIds.has(a.id) ? 1 : 0;
      const bv = this.alreadyVotedIds.has(b.id) ? 1 : 0;
      if (av !== bv) return av - bv;
      return `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`);
    });
  }

  /** Récupère le nom complet à partir d'une réponse (ResponseRow) */
  getResponseFullName(r: ResponseRow): string {
    return this.surveyResults.getResponseFullName(r, this.members);
  }

  get manualReachableQuestions(): QuestionResult[] {
    return getReachableQuestions(this.questions, this.manualAnswers);
  }

  selectManualAnswer(questionId: string, value: string) {
    const current = this.manualAnswers[questionId];
    const answer = current?.optionValue === value ? current : { optionValue: value };
    this.manualAnswers = sanitizeSurveyAnswers(this.questions, { ...this.manualAnswers, [questionId]: answer });
  }

  selectManualDetail(questionId: string, detailValue: string) {
    const current = this.manualAnswers[questionId];
    if (!current) return;
    this.manualAnswers = sanitizeSurveyAnswers(this.questions, {
      ...this.manualAnswers,
      [questionId]: { ...current, detailValue },
    });
  }

  async ngOnInit() {
    this.surveyId = this.route.snapshot.paramMap.get('id') ?? '';

    const [survey, qs, rs] = await Promise.all([
      this.sondageService.getSurvey(this.surveyId),
      this.sondageService.listQuestionsForSurvey(this.surveyId),
      this.sondageService.listResponsesForSurvey(this.surveyId),
    ]);

    this.surveyTitle = survey?.title ?? '';
    this.surveyProductId = survey?.productTag ?? '';

    this.questions = (qs as any[]).map((q: any) => ({
      id: q.id,
      order: q.order,
      text: q.text,
      resultLabel: q.resultLabel,
      detailResultLabel: q.detailResultLabel,
      options: q.options ?? [],
    }));

    // Charger les membres avant de trier les réponses
    this.members = await firstValueFrom(this.membersService.listMembers());

    this.setResponses(rs as any[]);
    this.loading = false;
  }

  private setResponses(raw: any[]) {
    const mappedResponses = this.surveyResults.mapRawResponses(raw);

    this.responses = mappedResponses.sort((a, b) => {
      if (a.paymentStatus !== b.paymentStatus) return a.paymentStatus === 'payable' ? -1 : 1;
      const aLabel = this.getResponseFullName(a);
      const bLabel = this.getResponseFullName(b);
      return aLabel.localeCompare(bLabel, 'fr', { sensitivity: 'base' });
    });

    this.alreadyVotedIds = new Set(this.responses.map(r => r.memberId));
  }

  get payableCount(): number {
    return this.responses.filter(response =>
      response.paymentStatus === 'payable' && !response.requiresReconfirmation
    ).length;
  }

  get hasPaymentOption(): boolean {
    return this.questions.some(question => question.options.some(option => option.payTag === true));
  }

  getAnswer(row: ResponseRow, questionId: string): string {
    const q = this.questions.find(q => q.id === questionId);
    if (!q) return '—';
    return this.surveyResults.getAnswerChoiceLabel(q, row.answers[questionId]);
  }

  getAnswerDetail(row: ResponseRow, questionId: string): string {
    const question = this.questions.find(candidate => candidate.id === questionId);
    if (!question) return '—';
    return this.surveyResults.getAnswerDetailLabel(question, row.answers[questionId]);
  }

  hasDetailList(question: QuestionResult): boolean {
    return question.options.some(option => !!option.detailOptions?.length);
  }

  truncateColumnTitle(title: string): string {
    const maxLength = SondageResultatsComponent.RESULT_COLUMN_TITLE_MAX_LENGTH;
    if (title.length <= maxLength) return title;
    const previousBoundary = title.lastIndexOf(' ', maxLength);
    const nextBoundary = title.indexOf(' ', maxLength + 1);
    const nearestBoundary = previousBoundary <= 0
      ? maxLength
      : nextBoundary < 0 || maxLength - previousBoundary <= nextBoundary - maxLength
        ? previousBoundary
        : nextBoundary;
    const truncated = title.slice(0, nearestBoundary);
    return `${truncated.trimEnd()}...`;
  }

  getResultColumnTitle(question: QuestionResult): string {
    return question.resultLabel?.trim() || this.truncateColumnTitle(question.text);
  }

  getDetailResultColumnTitle(question: QuestionResult): string {
    return question.detailResultLabel?.trim() || 'Valeur choisie';
  }

  // ── Vote manuel : ouvrir ───────────────────────────────────────────────────

  openAddVote() {
    this.editingResponseId = null;
    this.manualMemberId = '';
    this.manualIsExternal = false;
    this.manualExternalEmail = '';
    this.manualExternalFirstName = '';
    this.manualExternalLastName = '';
    this.manualAnswers = {};
    this.manualError = null;
    this.manualOpen = true;
  }

  openEditVote(row: ResponseRow) {
    this.editingResponseId = row.id;
    const isExternal = row.memberId === row.memberEmail;
    this.manualIsExternal = isExternal;
    if (isExternal) {
      this.manualMemberId = '';
      this.manualExternalEmail = row.memberEmail;
      // Parse name into firstName and lastName for editing
      const parts = row.memberName?.split(' ') || [''];
      this.manualExternalFirstName = parts[0];
      this.manualExternalLastName = parts.slice(1).join(' ');
    } else {
      this.manualMemberId = row.memberId;
      this.manualExternalEmail = '';
      this.manualExternalFirstName = '';
      this.manualExternalLastName = '';
    }
    this.manualAnswers = { ...row.answers };
    this.manualError = null;
    this.manualOpen = true;
  }

  /** Quand l'admin change de membre dans le select → pré-remplir si déjà voté */
  onManualMemberChange(memberId: string) {
    this.manualMemberId = memberId;
    if (!memberId) return;
    const existing = this.responses.find(r => r.memberId === memberId && r.memberId !== r.memberEmail);
    if (existing && !this.editingResponseId) {
      // pré-remplir avec le vote existant et basculer en mode édition
      this.editingResponseId = existing.id;
      this.manualAnswers = { ...existing.answers };
    } else if (!existing) {
      this.manualAnswers = {};
      this.editingResponseId = null;
    }
  }

  onManualModeToggle() {
    this.manualIsExternal = !this.manualIsExternal;
    this.manualMemberId = '';
    this.manualExternalEmail = '';
    this.manualExternalFirstName = '';
    this.manualExternalLastName = '';
    this.manualAnswers = {};
    this.editingResponseId = null;
  }

  async saveManualVote() {
    if (!isSurveyPathComplete(this.questions, this.manualAnswers)) {
      this.manualError = 'Veuillez répondre à la question affichée.';
      return;
    }
    this.manualAnswers = sanitizeSurveyAnswers(this.questions, this.manualAnswers);
    const paymentStatus = hasPaymentTag(this.questions, this.manualAnswers) ? 'payable' : 'notApplicable';
    const paymentProductId = paymentStatus === 'payable' ? this.surveyProductId : undefined;

    let externalEmail = '';
    let externalName = '';

    if (this.manualIsExternal) {
      externalEmail = this.manualExternalEmail.trim().toLowerCase();
      const firstName = this.manualExternalFirstName.trim();
      const lastName = this.manualExternalLastName.trim();
      externalName = firstName || lastName ? `${firstName} ${lastName}`.trim() : externalEmail;
      if (!externalEmail) {
        this.manualError = 'Veuillez saisir une adresse email pour le participant externe.';
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(externalEmail)) {
        this.manualError = 'Adresse email invalide.';
        return;
      }
    } else {
      if (!this.manualMemberId) {
        this.manualError = 'Veuillez sélectionner un membre.';
        return;
      }
    }

    this.savingManual = true;
    this.manualError = null;
    try {
      if (this.editingResponseId) {
        await this.sondageService.updateResponseAnswers(
          this.editingResponseId, this.manualAnswers, paymentStatus, paymentProductId
        );
      } else {
        if (this.manualIsExternal) {
          await this.sondageService.createManualResponse({
            surveyId: this.surveyId,
            memberId: externalEmail,
            memberEmail: externalEmail,
            memberName: externalName,
            answers: this.manualAnswers,
            paymentStatus,
            paymentProductId,
          });
        } else {
          const member = this.members.find(m => m.id === this.manualMemberId);
          if (!member) throw new Error('Membre introuvable');
          await this.sondageService.createManualResponse({
            surveyId: this.surveyId,
            memberId: member.id,
            memberEmail: member.email,
            memberName: `${member.firstname} ${member.lastname}`.trim(),
            answers: this.manualAnswers,
            paymentStatus,
            paymentProductId,
          });
        }
      }
      // Recharger les réponses
      const rs = await this.sondageService.listResponsesForSurvey(this.surveyId);
      this.setResponses(rs as any[]);
      this.manualOpen = false;
    } catch (err: any) {
      this.manualError = err?.message ?? 'Erreur lors de l\'enregistrement';
    } finally {
      this.savingManual = false;
    }
  }

  async deleteResponse(row: ResponseRow) {
    if (!confirm(`Supprimer le vote de « ${row.memberName} » ?`)) return;
    await this.sondageService.deleteResponse(row.id);
    this.responses = this.responses.filter(r => r.id !== row.id);
    this.alreadyVotedIds = new Set(this.responses.map(r => r.memberId));
  }

  exportCsv() {
    const headers = [
      'Nom',
      'Adhérent',
      'Date',
      ...this.questions.flatMap(question => this.hasDetailList(question)
        ? [this.getResultColumnTitle(question), this.getDetailResultColumnTitle(question)]
        : [this.getResultColumnTitle(question)]),
    ];
    const rows = this.responses.map(r => {
      const isMember = r.memberId !== r.memberEmail ? 'Oui' : 'ext';
      const answers = this.questions.flatMap(question => this.hasDetailList(question)
        ? [this.getAnswer(r, question.id), this.getAnswerDetail(r, question.id)]
        : [this.getAnswer(r, question.id)]);
      return [
        this.getResponseFullName(r),
        isMember,
        new Date(r.updatedAt).toLocaleDateString('fr-FR'),
        ...answers,
      ];
    });
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sondage-${this.surveyId}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  back() { this.router.navigate([BACK_ROUTE_ABS_PATHS['SondageList']]); }

  private readonly CHART_COLORS = [
    'rgba(13,110,253,0.75)',
    'rgba(25,135,84,0.75)',
    'rgba(220,53,69,0.75)',
    'rgba(255,193,7,0.9)',
    'rgba(108,117,125,0.65)',
    'rgba(13,202,240,0.75)',
    'rgba(111,66,193,0.75)',
  ];

  get questionProgress(): Array<{
    question: QuestionResult;
    total: number;
    options: Array<{
      label: string;
      count: number;
      percent: number;
      percentLabel: string;
      color: string;
    }>;
  }> {
    const confirmedResponses = this.responses.filter(response => !response.requiresReconfirmation);
    return this.questions
      .map((q) => ({
        question: q,
        total: confirmedResponses.filter(response => response.answers[q.id] !== undefined).length,
        options: q.options.map((option, idx) => {
          const label = option.keyword?.trim() || option.label;
          const count = confirmedResponses.filter((response) =>
            this.surveyResults.getAnswerIndex(q, response.answers[q.id]) === idx
          ).length;
          const total = confirmedResponses.filter(response => response.answers[q.id] !== undefined).length;
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          return {
            label,
            count,
            percent,
            percentLabel: `${percent} %`,
            color: this.CHART_COLORS[idx % this.CHART_COLORS.length],
          };
        }),
      }));
  }
}
  