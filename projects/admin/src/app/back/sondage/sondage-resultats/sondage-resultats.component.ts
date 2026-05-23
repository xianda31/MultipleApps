import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SondageService } from '../sondage.service';
import { MembersService } from '../../../common/services/members.service';
import { Member } from '../../../common/interfaces/member.interface';
import { BookService } from '../../services/book.service';

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
  firstName: string;
  lastName: string;
  memberEmail: string;
  memberId: string;
  isMember: boolean;
  createdAt: string;
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
  private bookService = inject(BookService);

  surveyId = '';
  surveyTitle = '';
  surveyProductTag = ''; // pour faciliter le filtrage en compta (ex: "PAF Tournoi XYZ")
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
    this.surveyProductTag = survey?.productTag ?? '';

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
    const mappedResponses = raw.map((r: any) => {
      const memberName = r.memberName?.trim() || r.memberEmail;
      const { firstName, lastName } = this.parseMemberName(memberName);
      return {
        id: r.id,
        memberName,
        firstName,
        lastName,
        memberEmail: r.memberEmail,
        memberId: r.memberId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt ?? r.submittedAt,
        answers: (() => { let v = r.answers; if (typeof v === 'string') v = JSON.parse(v); if (typeof v === 'string') v = JSON.parse(v); return v ?? {}; })(),
        isMember: r.memberId !== r.memberEmail, // convention : si memberId === memberEmail alors c'est un non-membre
      };
    });

    this.responses = mappedResponses.sort((a, b) => {
      const aAbsent = this.isAbsent(a);
      const bAbsent = this.isAbsent(b);

      // Présents en premier, absents ensuite.
      if (aAbsent !== bAbsent) return aAbsent ? 1 : -1;

      const aLabel = `${a.lastName} ${a.firstName}`.trim() || a.memberName;
      const bLabel = `${b.lastName} ${b.firstName}`.trim() || b.memberName;
      return aLabel.localeCompare(bLabel, 'fr', { sensitivity: 'base' });
    });

    this.alreadyVotedIds = new Set(this.responses.map(r => r.memberId));
  }

  private parseMemberName(memberName: string): { firstName: string; lastName: string } {
    const parts = (memberName ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  get invitationQuestion(): QuestionResult | null {
    return this.questions.find(q => q.order === -1) ?? null;
  }

  private normalizeAnswer(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  isAbsent(row: ResponseRow): boolean {
    const invQ = this.invitationQuestion;
    if (!invQ) return false;

    // Convention historique: l'option 0 de la question d'invitation représente l'absence.
    // On complète avec une détection par libellé/keyword pour couvrir les variantes (ex: "Non").
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
    const rows = this.responses.map(r => {
      const payment = r.isMember ? this.product_paied(r.memberId) : null;
      return [
        r.memberName,
        payment ?? '',
        new Date(r.updatedAt).toLocaleDateString('fr-FR'),
        ...this.questions.map(q => this.getAnswer(r, q.id)),
      ];
    });
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sondage-${this.surveyId}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  product_paied( memberId: string): number | null {
    const member = this.members.find(m => m.id === memberId);
    // pour l'instant on renvoie 0
    return member ? 0 : null;
    // TODO : remplacer par une vraie vérification de paiement, par exemple en ajoutant un champ "get_member_payment_by_product_tag" dans les réponses
    // return member ? this.bookService.get_member_payment_by_product_tag(this.membersService.full_name(member), this.surveyProductTag) : null;
  }

  back() { this.router.navigate(['/back/communication/sondage']); }
}
