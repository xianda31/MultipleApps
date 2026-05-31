import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ActivatedRoute, Router } from '@angular/router';
import { SondageService } from '../sondage.service';
import { MembersService } from '../../../common/services/members.service';
import { Member } from '../../../common/interfaces/member.interface';
import { BookService } from '../../services/book.service';
import { ProductService } from '../../../common/services/product.service';
import { SaleItem } from '../../products/sale-item.interface';
import { firstValueFrom } from 'rxjs';
import { BACK_ROUTE_ABS_PATHS } from '../../routes/back-route-paths';

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
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './sondage-resultats.component.html',
})
export class SondageResultatsComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sondageService: SondageService,
    public membersService: MembersService,
    private bookService: BookService,
    private productService: ProductService,
  ) {}
  

  surveyId = '';
  surveyTitle = '';
  surveySaleItem: SaleItem | null = null;
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

  /** Récupère le nom complet à partir d'une réponse (ResponseRow) */
  getResponseFullName(r: ResponseRow): string {
    const member = this.members.find(m => m.id === r.memberId);
    if (member) {
      return this.membersService.full_name(member);
    }
    // Fallback si le membre n'est pas trouvé
    return (r.lastName + ' ' + r.firstName).trim() || r.memberName;
  }

  async ngOnInit() {
    this.surveyId = this.route.snapshot.paramMap.get('id') ?? '';

    const [survey, qs, rs] = await Promise.all([
      this.sondageService.getSurvey(this.surveyId),
      this.sondageService.listQuestionsForSurvey(this.surveyId),
      this.sondageService.listResponsesForSurvey(this.surveyId),
    ]);

    this.surveyTitle = survey?.title ?? '';
    const surveyProductRef = (survey?.productTag ?? '').trim();
    const products = await firstValueFrom(this.productService.listProducts());
    this.surveySaleItem = !surveyProductRef
      ? null
      : products.find((p) => p.id === surveyProductRef)
        ?? products.find((p) => p.productCode === surveyProductRef)
        ?? products.find((p) => p.name === surveyProductRef)
        ?? null;

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

      // Trier en utilisant le nom affiché (member.lastname firstname) pour la cohérence
      const aLabel = this.getResponseFullName(a);
      const bLabel = this.getResponseFullName(b);
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

  get isRsvpMode(): boolean {
    return !!this.invitationQuestion;
  }

  get presentCount(): number {
    return this.responses.filter(r => !this.isAbsent(r)).length;
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
      const answers = this.questions.map(q => {
        // Si RSVP et présence=non → vider les réponses des questions non-invitation
        if (this.isAbsent(r) && q.order !== -1) {
          return '';
        }
        return this.getAnswer(r, q.id);
      });
      return [
        r.memberName,
        payment ?? '',
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

  product_paied( memberId: string): number | null {
    const member = this.members.find(m => m.id === memberId);
    const full_name = member ? this.membersService.full_name(member) : null;
    if (!full_name) return null;

    const account = this.surveySaleItem?.account;
    const productCode = this.surveySaleItem?.productCode?.trim();
    if (!account || !productCode) return 0;
    const expectedCode = productCode.replace(/^#/, '').toLowerCase();
    
    const revenues = this.bookService.get_revenues_from_members().filter((revenue) => revenue.member === full_name);
    const total = revenues.reduce((sum, rev) => {
      const codes = (rev.productCodes ?? '')
        .split(/\s+/)
        .map((code) => code.replace(/^#/, '').toLowerCase())
        .filter(Boolean);
      if (!codes.includes(expectedCode)) return sum;
      const amount = rev.values[account];
      return sum + (typeof amount === 'number' ? amount : 0);
    }, 0);
    return total;
    // TODO : remplacer par une vraie vérification de paiement, par exemple en ajoutant un champ "get_member_payment_by_product_tag" dans les réponses
    
    // return member ? this.bookService.get_member_payment_by_product_tag(this.membersService.full_name(member), this.surveySaleItemTag) : null;
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

  get questionCharts(): Array<{ question: QuestionResult; chartData: any; chartOptions: ChartOptions<'bar'> }> {
    return this.questions
      .filter(q => q.order !== -1)
      .map(q => {
        const labels = q.options.map((opt, idx) => {
          const kw = q.optionKeywords[idx]?.trim();
          return kw || opt;
        });
        const counts = q.options.map((_, idx) =>
          this.responses.filter(r => !this.isAbsent(r) && r.answers[q.id] === idx).length
        );
        return {
          question: q,
          chartData: {
            labels,
            datasets: [{
              data: counts,
              backgroundColor: labels.map((_, i) => this.CHART_COLORS[i % this.CHART_COLORS.length]),
              borderWidth: 1,
            }],
          },
          chartOptions: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 } },
            },
          } as ChartOptions<'bar'>,
        };
      });
  }
}
  