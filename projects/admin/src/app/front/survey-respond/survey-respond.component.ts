import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SurveyRespondService, SurveyRespondData } from './survey-respond.service';
import { MembersService } from '../../common/services/members.service';
import { Member } from '../../common/interfaces/member.interface';

type PageState = 'loading' | 'error' | 'form' | 'done';

@Component({
  selector: 'app-survey-respond',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './survey-respond.component.html',
})
export class SurveyRespondComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private surveyService = inject(SurveyRespondService);
  private membersService = inject(MembersService);

  state: PageState = 'loading';
  errorMsg = '';
  token = '';

  data: SurveyRespondData | null = null;
  answers: Record<string, number> = {};  // questionId → optionIndex
  members: Member[] = [];

  saving = false;
  saveError = '';

  get survey() { return this.data?.survey ?? null; }
  get questions() { return this.data?.questions ?? []; }
  get existingResponse() { return this.data?.existingResponse ?? null; }
  get invitationQuestion() {
    return this.questions.find((q: any) => q.order === -1) ?? null;
  }
  get isInvitationDeclined(): boolean {
    const q = this.invitationQuestion;
    if (!q) return false;
    const idx = this.answers[q.id];
    // Convention: option index 0 of invitation question means "absent / ne vient pas".
    return idx === 0;
  }

  private readonly PROGRESS_COLORS = [
    '#0d6efd', '#198754', '#dc3545', '#ffc107', '#6c757d', '#0dcaf0', '#6f42c1',
  ];

  get questionProgress(): Array<{
    question: { id: string; text: string; options: string[] };
    total: number;
    options: Array<{ label: string; count: number; percent: number; percentLabel: string; color: string }>;
  }> {
    if (!this.data?.aggregatedResults) return [];
    return this.questions
      .filter(q => q.order !== -1)
      .map(q => {
        const counts = this.data!.aggregatedResults![q.id] ?? [];
        const total = counts.reduce((a, b) => a + b, 0);
        return {
          question: q,
          total,
          options: q.options.map((opt, idx) => {
            const label = q.optionKeywords?.[idx]?.trim() || opt;
            const count = counts[idx] ?? 0;
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return { label, count, percent, percentLabel: `${percent} %`, color: this.PROGRESS_COLORS[idx % this.PROGRESS_COLORS.length] };
          }),
        };
      });
  }
  get isClosed() {
    if (!this.survey) return false;
    if (this.survey.status === 'closed') return true;
    if (!this.survey.closingDate) return false;

    const closingDate = new Date(this.survey.closingDate);
    closingDate.setHours(23, 59, 59, 999);
    return closingDate.getTime() < Date.now();
  }
  get firstName() {
    if (!this.data?.memberId) return this.data?.memberName?.split(' ')?.[0] ?? '';
    const member = this.members.find(m => m.id === this.data!.memberId);
    return member?.firstname ?? '';
  }

  /** True si toutes les questions ont une réponse */
  get allAnswered(): boolean {
    if (this.isInvitationDeclined) return true;
    return this.questions.every(q => this.answers[q.id] !== undefined);
  }

  async ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.errorMsg = 'Lien invalide : aucun token fourni.';
      this.state = 'error';
      return;
    }
    // Charger les membres pour pouvoir récupérer le firstName
    this.membersService.listMembers().subscribe(members => {
      this.members = members;
    });
    await this.reload();
  }

  private async reload() {
    this.state = 'loading';
    try {
      this.data = await this.surveyService.load(this.token);
      // Pré-remplir les réponses existantes
      if (this.existingResponse?.answers) {
        const raw = this.existingResponse.answers;
        this.answers = typeof raw === 'string' ? JSON.parse(raw) : { ...raw };
      } else {
        this.answers = {};
      }
      this.state = this.existingResponse ? 'done' : 'form';
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'Erreur lors du chargement';
      this.state = 'error';
    }
  }

  // ── Poll : soumettre ────────────────────────────────────────────────────

  async submitPoll() {
    if (!this.allAnswered) {
      this.saveError = 'Veuillez répondre à toutes les questions (sauf si vous avez indiqué ne pas venir à la question 0).';
      return;
    }
    this.saving = true; this.saveError = '';
    try {
      await this.surveyService.submit(this.token, this.answers);
      await this.reload();
    } catch (e: any) {
      this.saveError = e?.message ?? 'Erreur';
    } finally { this.saving = false; }
  }

  editAgain() {
    this.state = 'form';
    this.saveError = '';
  }
}
