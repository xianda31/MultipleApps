import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SurveyRespondService, SurveyRespondData } from './survey-respond.service';

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
  answers: Record<string, number> = {};  // questionId → optionIndex

  saving = false;
  saveError = '';

  get survey() { return this.data?.survey ?? null; }
  get questions() { return this.data?.questions ?? []; }
  get existingResponse() { return this.data?.existingResponse ?? null; }
  get isRsvp() { return this.survey?.surveyType === 'rsvp'; }
  get isClosed() {
    if (!this.survey) return false;
    if (this.survey.status === 'closed') return true;
    if (!this.survey.closingDate) return false;
    return new Date(this.survey.closingDate).getTime() <= Date.now();
  }
  get status() { return this.existingResponse?.status ?? null; }
  get firstName() { return this.data?.memberName?.split(' ')?.[0] ?? this.data?.memberName ?? ''; }

  /** True si toutes les questions ont une réponse */
  get allAnswered(): boolean {
    return this.questions.every(q => this.answers[q.id] !== undefined);
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
    if (!this.allAnswered) { this.saveError = 'Veuillez répondre à toutes les questions.'; return; }
    this.saving = true; this.saveError = '';
    try {
      await this.surveyService.submit(this.token, this.answers);
      await this.reload();
    } catch (e: any) {
      this.saveError = e?.message ?? 'Erreur';
    } finally { this.saving = false; }
  }

  // ── RSVP : statut ───────────────────────────────────────────────────────

  async rsvpAnswer(status: 'confirmed' | 'declined') {
    this.saving = true; this.saveError = '';
    try {
      if (this.existingResponse) {
        await this.surveyService.updateStatus(this.token, status);
      } else {
        // Première réponse RSVP : soumettre + statut
        await this.surveyService.submit(this.token, this.answers);
        await this.surveyService.updateStatus(this.token, status);
      }
      await this.reload();
    } catch (e: any) {
      this.saveError = e?.message ?? 'Erreur';
    } finally { this.saving = false; }
  }

  async changeStatus(status: 'confirmed' | 'declined' | 'cancelled') {
    this.saving = true; this.saveError = '';
    try {
      await this.surveyService.updateStatus(this.token, status);
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
