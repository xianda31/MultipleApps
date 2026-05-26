import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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

  // Sondage optionnel
  surveys: SurveyItem[] = [];
  selectedSurveyId = '';
  selectedSurvey: SurveyItem | null = null;
  loadingSurvey = false;

  // Message
  recipients: Member[] = [];
  externalRecipients: Array<{ email: string; name: string }> = [];
  externalEmail = '';
  externalName = '';
  externalRecipientError: string | null = null;
  subject = '';
  bodyHtml = '';
  previewHtml: SafeHtml = '';
  sending = false;
  result: any = null;
  error: string | null = null;
  skippedRecipients: string[] = [];
  attachments: Array<{filename: string, content: string, contentType: string}> = [];

  get isSurveyMode(): boolean { return !!this.selectedSurveyId; }
  get surveyRecipientCount(): number { return this.recipients.length + this.externalRecipients.length; }
  get totalRecipientCount(): number { return this.recipients.length + this.externalRecipients.length; }
  get configuredCcEmail(): string { return this.mailingService.getConfiguredCcEmail(); }

  constructor(
    private mailingService: MailingService,
    private sondageService: SondageService,
    private sanitizer: DomSanitizer
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
    if (!id) {
      this.selectedSurvey = null;
      this.externalRecipientError = null;
      this.updatePreview();
      return;
    }
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

  private stripScripts(html: string): string {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  updatePreview() {
    const body = this.isSurveyMode
      ? this.bodyHtml + this.surveyCtaHtml()
      : this.bodyHtml;
    const html = this.stripScripts(this.mailingService.buildEmailTemplate(body));
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  onRecipientsChange(members: Member[]) {
    this.recipients = members;
    this.externalRecipientError = null;
  }

  addExternalRecipient() {
    this.externalRecipientError = null;
    const email = this.externalEmail.trim().toLowerCase();
    const name = this.externalName.trim();

    if (!email) {
      this.externalRecipientError = 'Veuillez saisir une adresse email externe.';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.externalRecipientError = 'Adresse email invalide.';
      return;
    }

    const alreadyInMembers = this.recipients.some((m) => (m.email ?? '').trim().toLowerCase() === email);
    if (alreadyInMembers) {
      this.externalRecipientError = 'Cette adresse est déjà présente dans les membres sélectionnés.';
      return;
    }

    const alreadyInExternals = this.externalRecipients.some((r) => r.email.toLowerCase() === email);
    if (alreadyInExternals) {
      this.externalRecipientError = 'Cette adresse externe est déjà ajoutée.';
      return;
    }

    this.externalRecipients.push({ email, name });
    this.externalEmail = '';
    this.externalName = '';
  }

  removeExternalRecipient(index: number) {
    this.externalRecipients.splice(index, 1);
    this.externalRecipientError = null;
  }

  onContentChange(event: Event): void {
    const editorHtml = this.editorDiv?.nativeElement?.innerHTML;
    const eventHtml = (event.target as HTMLElement | null)?.innerHTML;
    this.bodyHtml = editorHtml ?? eventHtml ?? '';
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
    this.externalRecipients = [];
    this.externalEmail = '';
    this.externalName = '';
    this.externalRecipientError = null;
    this.selectedSurveyId = '';
    this.selectedSurvey = null;
    if (this.editorDiv) {
      this.editorDiv.nativeElement.innerHTML = '';
    }
    this.updatePreview();
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
      if (this.surveyRecipientCount === 0) {
        this.error = 'Aucun destinataire sélectionné.';
        this.sending = false;
        return;
      }
      const memberRecipientPayload = this.recipients.map(m => ({
        email: m.email!,
        name: `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim(),
        memberId: m.id,
        isExternal: false,
      }));
      const externalRecipientPayload = this.externalRecipients.map(r => ({
        email: r.email,
        name: r.name,
        isExternal: true,
      }));
      const recipientPayload = [...memberRecipientPayload, ...externalRecipientPayload];
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

    const memberEmails = this.recipients.map(m => (m.email ?? '').trim().toLowerCase()).filter(Boolean);
    const externalEmails = this.externalRecipients.map(r => r.email.trim().toLowerCase()).filter(Boolean);
    const toArray = [...new Set([...memberEmails, ...externalEmails])] as string[];
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

