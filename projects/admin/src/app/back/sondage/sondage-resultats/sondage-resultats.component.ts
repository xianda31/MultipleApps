import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SondageService } from '../sondage.service';
import { SurveyResultsService, QuestionResult, ResponseRow } from '../survey-results.service';
import { MembersService } from '../../../common/services/members.service';
import { Member } from '../../../common/interfaces/member.interface';
import { firstValueFrom } from 'rxjs';
import { BACK_ROUTE_ABS_PATHS } from '../../routes/back-route-paths';

@Component({
  selector: 'app-sondage-resultats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sondage-resultats.component.html',
})
export class SondageResultatsComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sondageService: SondageService,
    private surveyResults: SurveyResultsService,
    public membersService: MembersService,
  ) {}
  

  surveyId = '';
  surveyTitle = '';
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
  manualAnswers: Record<string, number> = {};
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

  async ngOnInit() {
    this.surveyId = this.route.snapshot.paramMap.get('id') ?? '';

    const [survey, qs, rs] = await Promise.all([
      this.sondageService.getSurvey(this.surveyId),
      this.sondageService.listQuestionsForSurvey(this.surveyId),
      this.sondageService.listResponsesForSurvey(this.surveyId),
    ]);

    this.surveyTitle = survey?.title ?? '';

    this.questions = (qs as any[]).map((q: any) => ({
      id: q.id, order: q.order, text: q.text, options: q.options ?? [],
      optionKeywords: q.optionKeywords ?? [],
    }));

    // Charger les membres avant de trier les réponses
    this.members = await firstValueFrom(this.membersService.listMembers());

    this.setResponses(rs as any[]);
    this.loading = false;
  }

  private setResponses(raw: any[]) {
    const mappedResponses = this.surveyResults.mapRawResponses(raw);

    this.responses = mappedResponses.sort((a, b) => {
      const aAbsent = this.isAbsent(a);
      const bAbsent = this.isAbsent(b);

      // Présents en premier, absents ensuite.
      if (aAbsent !== bAbsent) return aAbsent ? 1 : -1;

      // Trier en utilisant le nom affiché (member.lastname firstname) pour la cohérence
      const aLabel = this.getResponseFullName(a);
      const bLabel = this.getResponseFullName(b);
      return aLabel.localeCompare(bLabel, 'fr', { sensitivity: 'base' });
    });

    this.alreadyVotedIds = new Set(this.responses.map(r => r.memberId));
  }

  get invitationQuestion(): QuestionResult | null {
    return this.questions.find(q => q.order === -1) ?? null;
  }

  get isRsvpMode(): boolean {
    return !!this.invitationQuestion;
  }

  get presentCount(): number {
    return this.responses.filter(r => !this.isAbsent(r)).length;
  }

  isAbsent(row: ResponseRow): boolean {
    return this.surveyResults.isAbsent(row, this.questions);
  }

  private getDefaultPresentOptionIndex(): number {
    return this.surveyResults.getDefaultPresentOptionIndex(this.questions);
  }

  getAnswer(row: ResponseRow, questionId: string): string {
    const q = this.questions.find(q => q.id === questionId);
    if (!q) return '—';
    const idx = row.answers[questionId];
    if (idx === undefined) return '—';
    const kw = q.optionKeywords[idx]?.trim();
    return kw || q.options[idx] || '—';
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
    // Pré-sélectionner l'option "présent" pour la question d'invitation (RSVP)
    const invQ = this.invitationQuestion;
    if (invQ) {
      this.manualAnswers[invQ.id] = this.getDefaultPresentOptionIndex();
    }
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
    const requiredQs = this.questions.filter(q => q.order !== -1); // invitation optionnelle
    if (requiredQs.some(q => this.manualAnswers[q.id] === undefined)) {
      this.manualError = 'Veuillez répondre à toutes les questions.';
      return;
    }
    
    // Vérifier que la question d'invitation est répondue si elle existe
    const invQ = this.invitationQuestion;
    if (invQ && this.manualAnswers[invQ.id] === undefined) {
      this.manualError = 'Veuillez indiquer la présence/absence.';
      return;
    }

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
        await this.sondageService.updateResponseAnswers(this.editingResponseId, this.manualAnswers);
      } else {
        if (this.manualIsExternal) {
          await this.sondageService.createManualResponse({
            surveyId: this.surveyId,
            memberId: externalEmail,
            memberEmail: externalEmail,
            memberName: externalName,
            answers: this.manualAnswers,
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
    const headers = ['Nom', 'Adhérent', 'Date', ...this.questions.map(q => q.text)];
    const rows = this.responses.map(r => {
      const isMember = r.memberId !== r.memberEmail ? 'Oui' : 'ext';
      const answers = this.questions.map(q => {
        // Si RSVP et présence=non → vider les réponses des questions non-invitation
        if (this.isAbsent(r) && q.order !== -1) {
          return '';
        }
        return this.getAnswer(r, q.id);
      });
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
    const total = this.presentCount;

    return this.questions
      .filter(q => q.order !== -1)
      .map((q) => ({
        question: q,
        total,
        options: q.options.map((opt, idx) => {
          const label = q.optionKeywords[idx]?.trim() || opt;
          const count = this.responses.filter((r) => !this.isAbsent(r) && r.answers[q.id] === idx).length;
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
  