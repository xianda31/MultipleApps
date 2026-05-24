import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SondageService, SurveyItem } from '../sondage.service';
import { Member } from '../../../common/interfaces/member.interface';

type Survey = SurveyItem;

@Component({
  selector: 'app-sondage-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sondage-list.component.html',
})
export class SondageListComponent implements OnInit {
  private router = inject(Router);
  private sondageService = inject(SondageService);
  surveys: Survey[] = [];
  loading = true;

  sendTargetSurvey: Survey | null = null;
  sendRecipients: Member[] = [];
  sending = false;
  sendResult: any = null;
  sendError: string | null = null;

  readonly statusLabel: Record<'active' | 'closed', string> = {
    active: 'En cours',
    closed: 'Clôturé',
  };
  readonly statusClass: Record<'active' | 'closed', string> = {
    active: 'success',
    closed: 'danger',
  };

  async ngOnInit() {
    this.surveys = await this.sondageService.listSurveys();
    this.loading = false;
  }

  goCreate() {
    this.router.navigate(['/back/communication/sondage/editor/new']);
  }

  goEdit(id: string) {
    this.router.navigate(['/back/communication/sondage/editor', id]);
  }

  goResultats(id: string) {
    this.router.navigate(['/back/communication/sondage', id, 'resultats']);
  }

  async publish(survey: Survey) {
    // Direct publish without email (kept for compatibility)
    await this.sondageService.updateSurveyStatus(survey.id, 'active');
    survey.status = 'active';
  }

//   openSendPanel(survey: Survey) {
//     this.sendTargetSurvey = survey;
//     this.sendRecipients = [];
//   }

//   closeSendPanel() {
//     this.sendTargetSurvey = null;
//   }

//   onSendRecipientsChange(members: Member[]) {
//     this.sendRecipients = members;
//   }

//   async confirmSend() {
//     if (!this.sendTargetSurvey) return;
//     this.sending = true;
//     this.sendResult = null;
//     this.sendError = null;
//     try {
//       // Publier si encore brouillon
//       if (this.sendTargetSurvey.status === 'draft') {
//         await this.sondageService.updateSurveyStatus(this.sendTargetSurvey.id, 'active');
//         const survey = this.surveys.find(s => s.id === this.sendTargetSurvey!.id);
//         if (survey) survey.status = 'active';
//       }
//       // Charger les questions pour construire le template email
//       const questions = await this.sondageService.listQuestionsForSurvey(this.sendTargetSurvey.id);
//       const surveyBody = this.sondageService.buildSurveyEmailBody(this.sendTargetSurvey, questions);
//       const recipientPayload = this.sendRecipients.map(m => ({
//         email: m.email!,
//         name: `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim(),
//         memberId: m.id,
//       }));
//       this.sendResult = await this.mailingService.sendSurvey({
//         surveyId: this.sendTargetSurvey.id,
//         subject: this.sendTargetSurvey.title,
//         surveyBodyHtml: surveyBody,
//         closingDate: (this.sendTargetSurvey as any).closingDate,
//         recipients: recipientPayload,
//       });
//       this.closeSendPanel();
//     } catch (err: any) {
//       this.sendError = err?.message || 'Erreur lors de l\'envoi';
//     } finally {
//       this.sending = false;
//     }
//   }

  async close(survey: Survey) {
    await this.sondageService.updateSurveyStatus(survey.id, 'closed');
    survey.status = 'closed';
  }
  async reopen(survey: Survey) {
    await this.sondageService.updateSurveyStatus(survey.id, 'active');
    survey.status = 'active';
  }

  async deleteSurvey(survey: Survey) {
    if (!confirm(`Supprimer « ${survey.title} » ?`)) return;
    await this.sondageService.deleteSurvey(survey.id);
    this.surveys = this.surveys.filter(s => s.id !== survey.id);
  }

  effectiveStatus(survey: Survey): 'active' | 'closed' {
    if (survey.status === 'closed') return 'closed';
    return this.isTimedOut(survey) ? 'closed' : 'active';
  }

  canClose(survey: Survey): boolean {
    return this.effectiveStatus(survey) === 'active';
  }

  canReopen(survey: Survey): boolean {
    return survey.status === 'closed' && !this.isTimedOut(survey);
  }

  private isTimedOut(survey: Survey): boolean {
    if (!survey.closingDate) return false;
    const closing = new Date(survey.closingDate);
    if (Number.isNaN(closing.getTime())) return false;
    closing.setHours(23, 59, 59, 999);
    return Date.now() > closing.getTime();
  }
}
