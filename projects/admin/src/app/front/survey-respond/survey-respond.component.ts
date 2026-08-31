import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SurveyRespondService, SurveyRespondData } from './survey-respond.service';
import {
  getReachableQuestions,
  isSurveyPathComplete,
  sanitizeSurveyAnswers,
  SurveyAnswers,
  SurveyQuestionDefinition,
} from '../../common/survey/survey-flow';

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

  state: PageState = 'loading';
  errorMsg = '';
  token = '';

  data: SurveyRespondData | null = null;
  answers: SurveyAnswers = {};

  saving = false;
  saveError = '';

  get survey() { return this.data?.survey ?? null; }
  get questions() { return this.data?.questions ?? []; }
  get existingResponse() { return this.data?.existingResponse ?? null; }
  get reachableQuestions(): SurveyQuestionDefinition[] {
    return getReachableQuestions(this.questions, this.answers);
  }

  private readonly PROGRESS_COLORS = [
    '#0d6efd', '#198754', '#dc3545', '#ffc107', '#6c757d', '#0dcaf0', '#6f42c1',
  ];

  get questionProgress(): Array<{
    question: SurveyQuestionDefinition;
    total: number;
    options: Array<{ label: string; count: number; percent: number; percentLabel: string; color: string }>;
  }> {
    if (!this.data?.aggregatedResults) return [];
    return this.questions
      .map(q => {
        const counts = this.data!.aggregatedResults![q.id] ?? [];
        const total = counts.reduce((a, b) => a + b, 0);
        return {
          question: q,
          total,
          options: q.options.map((option, idx) => {
            const label = option.keyword?.trim() || option.label;
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
    return this.data?.memberName?.split(' ')?.[0] ?? '';
  }

  getAnswerLabel(question: SurveyRespondData['questions'][number]): string {
    const answer = this.answers[question.id];
    if (!answer) return '—';
    const option = question.options.find(candidate => candidate.value === answer.optionValue);
    if (!option) return '—';
    const detail = option.detailOptions?.find(candidate => candidate.value === answer.detailValue)?.label;
    return detail ? `${option.label} : ${detail}` : option.label;
  }

  get allAnswered(): boolean {
    return isSurveyPathComplete(this.questions, this.answers);
  }

  selectAnswer(questionId: string, value: string) {
    const current = this.answers[questionId];
    const answer = current?.optionValue === value ? current : { optionValue: value };
    this.answers = sanitizeSurveyAnswers(this.questions, { ...this.answers, [questionId]: answer });
  }

  selectDetail(questionId: string, detailValue: string) {
    const current = this.answers[questionId];
    if (!current) return;
    this.answers = sanitizeSurveyAnswers(this.questions, {
      ...this.answers,
      [questionId]: { ...current, detailValue },
    });
  }

  async ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.errorMsg = 'Lien invalide : aucun token fourni.';
      this.state = 'error';
      return;
    }
    await this.reload();
  }

  private async reload() {
    this.state = 'loading';
    try {
      this.data = await this.surveyService.load(this.token);
      // Pré-remplir les réponses existantes
      if (this.existingResponse?.answers) {
        const raw = this.existingResponse.answers;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : { ...raw };
        this.answers = sanitizeSurveyAnswers(this.questions, parsed);
      } else {
        this.answers = {};
      }
      this.state = this.existingResponse?.requiresReconfirmation ? 'form' : this.existingResponse ? 'done' : 'form';
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'Erreur lors du chargement';
      this.state = 'error';
    }
  }

  // ── Poll : soumettre ────────────────────────────────────────────────────

  async submitPoll() {
    if (!this.allAnswered) {
      this.saveError = 'Veuillez répondre à la question affichée.';
      return;
    }
    this.saving = true; this.saveError = '';
    try {
      await this.surveyService.submit(this.token, sanitizeSurveyAnswers(this.questions, this.answers));
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
