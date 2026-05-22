import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SondageService } from '../sondage.service';
import { MembersService } from '../../../common/services/members.service';
import { Member } from '../../../common/interfaces/member.interface';

interface QuestionResult {
  id: string;
  order: number;
  text: string;
  options: string[];
  optionKeywords: string[];  // mot-clé court par option (peut être vide)
}

interface ResponseRow {
  id: string;
  memberName: string;
  memberEmail: string;
  memberId: string;
  updatedAt: string;
  answers: Record<string, number>; // questionId → optionIndex
}

@Component({
  selector: 'app-sondage-resultats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sondage-resultats.component.html',
})
export class SondageResultatsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sondageService = inject(SondageService);
  private membersService = inject(MembersService);

  surveyId = '';
  surveyTitle = '';
  questions: QuestionResult[] = [];
  responses: ResponseRow[] = [];
  members: Member[] = [];
  loading = true;

  // ── Vote manuel ────────────────────────────────────────────────────────────
  manualOpen = false;
  editingResponseId: string | null = null;   // null = nouveau vote
  manualMemberId = '';                        // m.id sélectionné
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

    this.membersService.listMembers().subscribe(members => {
      this.members = members;
    });

    this.setResponses(rs as any[]);
    this.loading = false;
  }

  private setResponses(raw: any[]) {
    this.responses = raw.map((r: any) => ({
      id: r.id,
      memberName: r.memberName?.trim() || r.memberEmail,
      memberEmail: r.memberEmail,
      memberId: r.memberId,
      updatedAt: r.updatedAt ?? r.submittedAt,
      answers: (() => { let v = r.answers; if (typeof v === 'string') v = JSON.parse(v); if (typeof v === 'string') v = JSON.parse(v); return v ?? {}; })(),
    }));
    this.alreadyVotedIds = new Set(this.responses.map(r => r.memberId));
  }

  get invitationQuestion(): QuestionResult | null {
    return this.questions.find(q => q.order === -1) ?? null;
  }

  isAbsent(row: ResponseRow): boolean {
    const invQ = this.invitationQuestion;
    if (!invQ) return false;
    // La première option (index 0) correspond à « absent » par convention (premier choix)
    // L'admin peut avoir défini un autre ordre ; on ne présume pas, on laisse la valeur visible.
    // isAbsent = true si l'option choisie a un keyword 'Absent' (insensible à la casse)
    const idx = row.answers[invQ.id];
    if (idx === undefined) return false;
    const kw = (invQ.optionKeywords[idx] ?? '').toLowerCase();
    return kw === 'absent';
  }

  getAnswer(row: ResponseRow, questionId: string): string {
    const q = this.questions.find(q => q.id === questionId);
    if (!q) return '—';
    const idx = row.answers[questionId];
    if (idx === undefined) return '—';
    // Utiliser le mot-clé s'il existe, sinon le texte de l'option
    const kw = q.optionKeywords[idx]?.trim();
    return kw || q.options[idx] || '—';
  }

  // ── Vote manuel : ouvrir ───────────────────────────────────────────────────

  openAddVote() {
    this.editingResponseId = null;
    this.manualMemberId = '';
    this.manualAnswers = {};
    this.manualError = null;
    this.manualOpen = true;
  }

  openEditVote(row: ResponseRow) {
    this.editingResponseId = row.id;
    this.manualMemberId = row.memberId;
    this.manualAnswers = { ...row.answers };
    this.manualError = null;
    this.manualOpen = true;
  }

  /** Quand l'admin change de membre dans le select → pré-remplir si déjà voté */
  onManualMemberChange(memberId: string) {
    this.manualMemberId = memberId;
    const existing = this.responses.find(r => r.memberId === memberId);
    if (existing && !this.editingResponseId) {
      // pré-remplir avec le vote existant et basculer en mode édition
      this.editingResponseId = existing.id;
      this.manualAnswers = { ...existing.answers };
    } else if (!existing) {
      this.manualAnswers = {};
      this.editingResponseId = null;
    }
  }

  async saveManualVote() {
    if (!this.manualMemberId) {
      this.manualError = 'Veuillez sélectionner un membre.';
      return;
    }
    const requiredQs = this.questions.filter(q => q.order !== -1); // invitation optionnelle
    if (requiredQs.some(q => this.manualAnswers[q.id] === undefined)) {
      this.manualError = 'Veuillez répondre à toutes les questions.';
      return;
    }
    this.savingManual = true;
    this.manualError = null;
    try {
      const member = this.members.find(m => m.id === this.manualMemberId);
      if (!member) throw new Error('Membre introuvable');

      if (this.editingResponseId) {
        await this.sondageService.updateResponseAnswers(this.editingResponseId, this.manualAnswers);
      } else {
        await this.sondageService.createManualResponse({
          surveyId: this.surveyId,
          memberId: member.id,
          memberEmail: member.email,
          memberName: `${member.firstname} ${member.lastname}`.trim(),
          answers: this.manualAnswers,
        });
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
    const headers = ['Nom', 'Paiement', 'Date', ...this.questions.map(q => q.text)];
    const rows = this.responses.map(r => [
      r.memberName,
      this.hasPayed(r.memberId) ? 'Oui' : 'Non',
      new Date(r.updatedAt).toLocaleDateString('fr-FR'),
      ...this.questions.map(q => this.getAnswer(r, q.id)),
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sondage-${this.surveyId}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  hasPayed(memberId: string): boolean {
    // TODO : remplacer par une vraie vérification de paiement, par exemple en ajoutant un champ "hasPayed" dans les réponses
    // pour l'instant on considère que les membres dont le nom contient "payé" ont payé, juste pour la démo
    const member = this.members.find(m => m.id === memberId);
    return member ? /payé/i.test(`${member.firstname} ${member.lastname}`) : false;
  }

  back() { this.router.navigate(['/back/communication/sondage']); }
}
