import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MailingService, SendEmailParams } from './mailing.service';
import { Member } from '../../common/interfaces/member.interface';
import { RecipientSelectorComponent } from '../../common/components/recipient-selector/recipient-selector.component';
import { SondageService, SurveyItem } from '../sondage/sondage.service';

@Component({
  selector: 'app-mailing.component',
  standalone: true,
  imports: [CommonModule, FormsModule, RecipientSelectorComponent],
  templateUrl: './mailing.component.html',
  styleUrl: './mailing.component.scss'
})
export class MailingComponent implements OnInit, AfterViewInit {
  @ViewChild('editorDiv') editorDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('previewFrame') previewFrame!: ElementRef<HTMLIFrameElement>;

  // Sondage optionnel
  surveys: SurveyItem[] = [];
  selectedSurveyId = '';
  selectedSurvey: SurveyItem | null = null;
  loadingSurvey = false;

  // Message
  recipients: Member[] = [];
  subject = '';
  bodyHtml = '';
  sending = false;
  result: any = null;
  error: string | null = null;
  skippedRecipients: string[] = [];
  attachments: Array<{filename: string, content: string, contentType: string}> = [];

  get isSurveyMode(): boolean { return !!this.selectedSurveyId; }

  constructor(
    private mailingService: MailingService,
    private sondageService: SondageService
  ) {}

  ngOnInit() {
    this.sondageService.listSurveys().then(s => this.surveys = s);
  }

  ngAfterViewInit() {
    if (this.editorDiv && this.bodyHtml) {
      this.editorDiv.nativeElement.innerHTML = this.bodyHtml;
    }
    this.updatePreview();
  }

  async onSurveySelect(id: string) {
    if (!id) { this.selectedSurvey = null; this.updatePreview(); return; }
    this.loadingSurvey = true;
    try {
      this.selectedSurvey = await this.sondageService.getSurvey(id);
      if (this.selectedSurvey && !this.subject) this.subject = (this.selectedSurvey as any).title ?? '';
      this.updatePreview();
    } finally {
      this.loadingSurvey = false;
    }
  }

  /** Bouton CTA sondage injecté automatiquement en fin de corps */
  private surveyCtaHtml(): string {
    return `
      <div style="text-align:center;margin:32px 0">
        <a href="[SURVEY_LINK]"
           style="background-color:#667eea;color:white;padding:14px 32px;border-radius:6px;
                  text-decoration:none;font-size:16px;font-weight:bold;display:inline-block">
          Accès au sondage
        </a>
      </div>`;
  }

  updatePreview() {
    if (this.previewFrame) {
      const body = this.isSurveyMode
        ? this.bodyHtml + this.surveyCtaHtml()
        : this.bodyHtml;
      this.previewFrame.nativeElement.srcdoc = this.mailingService.buildEmailTemplate(body);
    }
  }

  onRecipientsChange(members: Member[]) {
    this.recipients = members;
  }

  onContentChange(event: Event): void {
    const element = event.target as HTMLElement;
    this.bodyHtml = element.innerHTML;
    this.updatePreview();
  }

  formatText(command: string, value?: string): void {
    document.execCommand(command, false, value);
    this.editorDiv?.nativeElement.focus();
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          this.attachments.push({
            filename: file.name,
            content: base64,
            contentType: file.type || 'application/octet-stream'
          });
        };
        reader.readAsDataURL(file);
      });
    }
  }

  removeAttachment(index: number) {
    this.attachments.splice(index, 1);
  }

  resetForm() {
    this.subject = '';
    this.bodyHtml = '';
    this.attachments = [];
    this.recipients = [];
    this.selectedSurveyId = '';
    this.selectedSurvey = null;
    if (this.editorDiv) {
      this.editorDiv.nativeElement.innerHTML = '';
    }
  }

  sendMail() {
    this.sending = true;
    this.result = null;
    this.error = null;
    this.skippedRecipients = [];

    if (this.isSurveyMode) {
      if (!this.selectedSurvey) {
        this.error = 'Sondage introuvable.';
        this.sending = false;
        return;
      }
      if (!this.recipients.length) {
        this.error = 'Aucun destinataire sélectionné.';
        this.sending = false;
        return;
      }
      const recipientPayload = this.recipients.map(m => ({
        email: m.email!,
        name: `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim(),
        memberId: m.id,
      }));
      this.mailingService.sendSurvey({
        surveyId: this.selectedSurvey.id,
        subject: this.subject,
        surveyBodyHtml: this.bodyHtml + this.surveyCtaHtml(),
        closingDate: (this.selectedSurvey as any).closingDate,
        recipients: recipientPayload,
        attachments: this.attachments.length > 0 ? this.attachments : undefined,
      }).then(res => {
        this.result = res;
        this.sending = false;
      }).catch(err => {
        this.error = err?.message || "Erreur lors de l'envoi du sondage";
        this.sending = false;
      });
      return;
    }

    const toArray = this.recipients.map(m => m.email).filter(Boolean) as string[];
    if (toArray.length === 0) {
      this.error = 'Aucun destinataire sélectionné.';
      this.sending = false;
      return;
    }
    const emailParams: SendEmailParams = {
      to: toArray,
      subject: this.subject,
      bodyHtml: this.bodyHtml,
      attachments: this.attachments.length > 0 ? this.attachments : undefined
    };
    this.mailingService.sendEmail(emailParams)
      .then((res) => {
        this.result = res;
        this.skippedRecipients = res.skippedRecipients || [];
        this.sending = false;
        this.resetForm();
      })
      .catch((err) => {
        this.error = err?.message || "Erreur lors de l'envoi";
        this.sending = false;
      });
  }
}

