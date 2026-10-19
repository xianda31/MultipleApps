import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MailingProgress, MailingService, SendEmailParams } from './mailing.service';
import { Member } from '../../common/interfaces/member.interface';
import {
  RecipientPreset,
  RecipientSelectorComponent,
} from '../../common/components/recipient-selector/recipient-selector.component';
import { SondageService, SurveyItem } from '../sondage/sondage.service';
import { filter, firstValueFrom, switchMap, take } from 'rxjs';
import { DBhandler } from '../../common/services/graphQL.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { MembersService } from '../../common/services/members.service';
import { MailingList } from './mailing-list.interface';

@Component({
  selector: 'app-mailing.component',
  standalone: true,
  imports: [CommonModule, FormsModule, RecipientSelectorComponent],
  templateUrl: './mailing.component.html',
  styleUrl: './mailing.component.scss'
})
export class MailingComponent implements OnInit, AfterViewInit {
  @ViewChild('editorDiv') editorDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('recipientSelector') recipientSelector?: RecipientSelectorComponent;
  @ViewChild('copyRecipientSelector') copyRecipientSelector?: RecipientSelectorComponent;

  // Sondage optionnel
  surveys: SurveyItem[] = [];
  selectedSurveyId = '';
  selectedSurvey: SurveyItem | null = null;
  loadingSurvey = false;

  // Listes de diffusion membres
  mailingLists: MailingList[] = [];
  selectedDistributionId = '';
  selectedCopyDistributionId = '';
  mailingListTitle = '';
  creatingMailingList = false;
  mailingListBusy = false;
  mailingListDirty = false;
  mailingListMessage: string | null = null;
  mailingListError: string | null = null;
  private applyingMailingList = false;

  // Message
  recipients: Member[] = [];
  copyRecipients: Member[] = [];
  selectedListMembers: Member[] = [];
  externalRecipients: Array<{ email: string; name: string }> = [];
  externalCopyRecipients: Array<{ email: string; name: string }> = [];
  externalEmail = '';
  externalFirstName = '';
  externalLastName = '';
  externalRecipientError: string | null = null;
  externalCopyEmail = '';
  externalCopyName = '';
  externalCopyRecipientError: string | null = null;
  recipientComposerOpen = false;
  recipientComposerTab: 'to' | 'copy' = 'to';
  recipientSelectionMessage: string | null = null;
  private recipientSnapshot?: {
    recipientIds: string[];
    copyRecipientIds: string[];
    externalRecipients: Array<{ email: string; name: string }>;
    externalCopyRecipients: Array<{ email: string; name: string }>;
  };
  subject = '';
  bodyHtml = '';
  previewHtml: SafeHtml = '';
  sending = false;
  mailingProgress: MailingProgress | null = null;
  result: any = null;
  error: string | null = null;
  attachmentError: string | null = null;
  skippedRecipients: string[] = [];
  attachments: Array<{filename: string, content: string, contentType: string}> = [];
  private readonly maxAttachmentBytes = 4 * 1024 * 1024;

  get isSurveyMode(): boolean { return !!this.selectedSurveyId; }
  get surveyRecipientCount(): number { return this.recipients.length + this.externalRecipients.length; }
  get totalRecipientCount(): number { return this.recipients.length + this.externalRecipients.length; }
  get totalCopyRecipientCount(): number { return this.copyRecipients.length + this.externalCopyRecipients.length; }
  get configuredCcEmail(): string { return this.mailingService.getConfiguredCcEmail(); }
  get mailingProgressPercent(): number {
    if (!this.mailingProgress?.totalRecipients) return 0;
    return Math.min(100, Math.round(
      this.mailingProgress.sentCount * 100 / this.mailingProgress.totalRecipients,
    ));
  }
  get primaryRecipientEmails(): string[] {
    return [
      ...this.recipients.map((member) => member.email ?? ''),
      ...this.externalRecipients.map((recipient) => recipient.email),
    ].filter(Boolean);
  }
  get selectedMailingList(): MailingList | null {
    return this.mailingLists.find((list) => list.id === this.selectedDistributionId) ?? null;
  }

  constructor(
    private mailingService: MailingService,
    private sondageService: SondageService,
    private sanitizer: DomSanitizer,
    private dbHandler: DBhandler,
    private auth: AuthentificationService,
    private membersService: MembersService,
  ) {}

  ngOnInit() {
    this.sondageService.listSurveys().then(s => this.surveys = s);
    this.auth.isRestoringSession$.pipe(
      filter((isRestoring) => !isRestoring),
      switchMap(() => this.auth.logged_member$),
      filter((member) => member !== null),
      take(1),
    ).subscribe(() => void this.loadMailingLists());
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
    const primaryEmails = this.primaryRecipientEmails;
    this.copyRecipientSelector?.removeEmails(primaryEmails);
    const normalizedPrimaryEmails = new Set(primaryEmails.map((email) => email.trim().toLowerCase()));
    this.externalCopyRecipients = this.externalCopyRecipients
      .filter((recipient) => !normalizedPrimaryEmails.has(recipient.email));
  }

  onCopyRecipientsChange(members: Member[]) {
    this.copyRecipients = members;
    this.externalCopyRecipientError = null;
  }

  onMembershipChange(members: Member[]) {
    this.selectedListMembers = members;
    if (this.selectedMailingList && !this.applyingMailingList) {
      this.mailingListDirty = true;
    }
  }

  addSelectedMailingList(target: 'to' | 'copy'): void {
    const id = target === 'to' ? this.selectedDistributionId : this.selectedCopyDistributionId;
    const selector = target === 'to' ? this.recipientSelector : this.copyRecipientSelector;
    if (!id || !selector) {
      this.recipientSelectionMessage = 'Sélectionnez une liste à ajouter.';
      return;
    }

    const preset = this.getRecipientPreset(id);
    if (preset) {
      const addedCount = selector.addPreset(preset);
      this.recipientSelectionMessage = `${addedCount} nouveau(x) membre(s) ajouté(s).`;
      return;
    }

    const mailingList = this.mailingLists.find((list) => list.id === id);
    if (!mailingList) {
      this.recipientSelectionMessage = 'Liste de diffusion introuvable.';
      return;
    }

    const result = selector.addMemberNames(mailingList.members);
    this.recipientSelectionMessage = result.unavailableNames.length > 0
      ? `${result.addedCount} ajouté(s), ${result.unavailableNames.length} non chargeable(s).`
      : `${result.addedCount} nouveau(x) membre(s) ajouté(s) depuis « ${mailingList.title} ».`;
  }

  openRecipientComposer(tab: 'to' | 'copy' = 'to'): void {
    this.recipientSnapshot = {
      recipientIds: this.recipientSelector?.selectedMemberIds() ?? [],
      copyRecipientIds: this.copyRecipientSelector?.selectedMemberIds() ?? [],
      externalRecipients: this.externalRecipients.map((recipient) => ({ ...recipient })),
      externalCopyRecipients: this.externalCopyRecipients.map((recipient) => ({ ...recipient })),
    };
    this.recipientComposerTab = tab;
    this.recipientSelectionMessage = null;
    this.recipientComposerOpen = true;
  }

  applyRecipientComposer(): void {
    this.recipientSnapshot = undefined;
    this.recipientComposerOpen = false;
  }

  cancelRecipientComposer(): void {
    if (this.recipientSnapshot) {
      this.recipientSelector?.setSelectedMemberIds(this.recipientSnapshot.recipientIds);
      this.copyRecipientSelector?.setSelectedMemberIds(this.recipientSnapshot.copyRecipientIds);
      this.externalRecipients = this.recipientSnapshot.externalRecipients.map((recipient) => ({ ...recipient }));
      this.externalCopyRecipients = this.recipientSnapshot.externalCopyRecipients.map((recipient) => ({ ...recipient }));
    }
    this.recipientSnapshot = undefined;
    this.recipientComposerOpen = false;
  }

  startMailingListCreation(): void {
    this.creatingMailingList = true;
    this.mailingListTitle = '';
    this.clearMailingListFeedback();
  }

  cancelMailingListCreation(): void {
    this.creatingMailingList = false;
    this.mailingListTitle = '';
  }

  loadSelectedMailingList(): void {
    const mailingList = this.selectedMailingList;
    if (!mailingList || !this.recipientSelector) return;

    this.applyingMailingList = true;
    const unavailableNames = this.recipientSelector.loadMemberNames(mailingList.members);
    this.applyingMailingList = false;
    this.mailingListDirty = false;
    this.mailingListError = null;
    this.mailingListMessage = unavailableNames.length > 0
      ? `${mailingList.members.length - unavailableNames.length} membre(s) chargé(s). Non chargeable(s) : ${unavailableNames.join(', ')}.`
      : `${mailingList.members.length} membre(s) chargé(s).`;
  }

  async createMailingList(): Promise<void> {
    const title = this.mailingListTitle.trim();
    const owner = this.auth.currentMember?.firstname?.trim();
    if (!title || this.selectedListMembers.length === 0) {
      this.mailingListError = 'Renseignez un titre et sélectionnez au moins un membre.';
      return;
    }
    if (!owner) {
      this.mailingListError = 'Impossible d’identifier le créateur de la liste.';
      return;
    }

    this.mailingListBusy = true;
    this.clearMailingListFeedback();
    try {
      const created = await this.dbHandler.createMailingList({
        title,
        owner,
        members: this.selectedMemberNames(),
      });
      await this.loadMailingLists();
      this.selectedDistributionId = created.id;
      this.cancelMailingListCreation();
      this.mailingListDirty = false;
      this.mailingListMessage = `Liste « ${created.title} » créée.`;
    } catch (error) {
      console.error('MailingList.create failed', error);
      this.mailingListError = 'Impossible de créer la liste de diffusion.';
    } finally {
      this.mailingListBusy = false;
    }
  }

  async updateSelectedMailingList(): Promise<void> {
    const mailingList = this.selectedMailingList;
    if (!mailingList || this.selectedListMembers.length === 0) {
      this.mailingListError = 'Sélectionnez une liste et au moins un membre.';
      return;
    }

    this.mailingListBusy = true;
    this.clearMailingListFeedback();
    try {
      const updated = await this.dbHandler.updateMailingList({
        ...mailingList,
        members: this.selectedMemberNames(),
      });
      await this.loadMailingLists();
      this.selectedDistributionId = updated.id;
      this.mailingListDirty = false;
      this.mailingListMessage = `Liste « ${updated.title} » mise à jour.`;
    } catch (error) {
      console.error('MailingList.update failed', error);
      this.mailingListError = 'Impossible de mettre à jour la liste de diffusion.';
    } finally {
      this.mailingListBusy = false;
    }
  }

  async deleteSelectedMailingList(): Promise<void> {
    const mailingList = this.selectedMailingList;
    if (!mailingList || !confirm(`Supprimer la liste « ${mailingList.title} » ?`)) return;

    this.mailingListBusy = true;
    this.clearMailingListFeedback();
    try {
      await this.dbHandler.deleteMailingList(mailingList.id);
      await this.loadMailingLists();
      this.selectedDistributionId = '';
      this.cancelMailingListCreation();
      this.mailingListDirty = false;
      this.mailingListMessage = `Liste « ${mailingList.title} » supprimée.`;
    } catch (error) {
      console.error('MailingList.delete failed', error);
      this.mailingListError = 'Impossible de supprimer la liste de diffusion.';
    } finally {
      this.mailingListBusy = false;
    }
  }

  private async loadMailingLists(): Promise<void> {
    try {
      this.mailingLists = await firstValueFrom(this.dbHandler.listMailingLists());
    } catch (error) {
      console.error('MailingList.list failed', error);
      this.mailingListError = 'Impossible de charger les listes de diffusion.';
    }
  }

  private selectedMemberNames(): string[] {
    return [...new Set(this.selectedListMembers.map((member) => this.membersService.full_name(member)))];
  }

  private getRecipientPreset(id: string): RecipientPreset | null {
    if (id === '@active') return 'ACTIVE';
    if (id === '@overdue') return 'OVERDUE';
    if (id === '@adherents') return 'ADHERENTS';
    return null;
  }

  private clearMailingListFeedback(): void {
    this.mailingListMessage = null;
    this.mailingListError = null;
  }

  addExternalRecipient() {
    this.externalRecipientError = null;
    const email = this.externalEmail.trim().toLowerCase();
    const firstName = this.externalFirstName.trim();
    const lastName = this.externalLastName.trim();
    const name = (firstName + ' ' + lastName).trim();

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
    this.copyRecipientSelector?.removeEmails([email]);
    this.externalCopyRecipients = this.externalCopyRecipients.filter((recipient) => recipient.email !== email);
    this.externalEmail = '';
    this.externalFirstName = '';
    this.externalLastName = '';
  }

  removeExternalRecipient(index: number) {
    this.externalRecipients.splice(index, 1);
    this.externalRecipientError = null;
  }

  addExternalCopyRecipient(): void {
    this.externalCopyRecipientError = null;
    const email = this.externalCopyEmail.trim().toLowerCase();
    const name = this.externalCopyName.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      this.externalCopyRecipientError = 'Adresse email invalide.';
      return;
    }
    if (this.primaryRecipientEmails.some((recipientEmail) => recipientEmail.trim().toLowerCase() === email)) {
      this.externalCopyRecipientError = 'Cette adresse est déjà destinataire principale.';
      return;
    }
    if (this.configuredCcEmail.trim().toLowerCase() === email) {
      this.externalCopyRecipientError = 'Cette adresse reçoit déjà la copie automatique du club.';
      return;
    }
    const memberCopyExists = this.copyRecipients.some((member) => (member.email ?? '').trim().toLowerCase() === email);
    const externalCopyExists = this.externalCopyRecipients.some((recipient) => recipient.email === email);
    if (memberCopyExists || externalCopyExists) {
      this.externalCopyRecipientError = 'Cette adresse est déjà en copie.';
      return;
    }

    this.externalCopyRecipients.push({ email, name });
    this.externalCopyEmail = '';
    this.externalCopyName = '';
  }

  removeExternalCopyRecipient(index: number): void {
    this.externalCopyRecipients.splice(index, 1);
    this.externalCopyRecipientError = null;
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
      const existingBytes = this.attachments.reduce(
        (total, attachment) => total + Math.floor(attachment.content.length * 3 / 4),
        0,
      );
      const selectedBytes = Array.from(files).reduce((total, file) => total + file.size, 0);
      if (existingBytes + selectedBytes > this.maxAttachmentBytes) {
        this.attachmentError = 'Les pièces jointes sont limitées à 4 Mo au total. Publiez les documents sur le site et insérez un lien dans le message.';
        event.target.value = '';
        return;
      }
      this.attachmentError = null;
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
    this.attachmentError = null;
  }

  resetForm() {
    this.subject = '';
    this.bodyHtml = '';
    this.attachments = [];
    this.attachmentError = null;
    this.recipients = [];
    this.copyRecipients = [];
    this.externalRecipients = [];
    this.externalCopyRecipients = [];
    this.externalEmail = '';
    this.externalFirstName = '';
    this.externalLastName = '';
    this.externalRecipientError = null;
    this.externalCopyEmail = '';
    this.externalCopyName = '';
    this.externalCopyRecipientError = null;
    this.selectedSurveyId = '';
    this.selectedSurvey = null;
    this.applyingMailingList = true;
    this.recipientSelector?.clearSelection();
    this.copyRecipientSelector?.clearSelection();
    this.applyingMailingList = false;
    this.selectedDistributionId = '';
    this.cancelMailingListCreation();
    this.mailingListDirty = false;
    if (this.editorDiv) {
      this.editorDiv.nativeElement.innerHTML = '';
    }
    this.updatePreview();
  }

  sendMail() {
    this.sending = true;
    this.mailingProgress = null;
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
      const copyRecipientPayload = [
        ...this.copyRecipients.map(m => ({
          email: m.email!,
          name: `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim(),
          memberId: m.id,
          isExternal: false,
        })),
        ...this.externalCopyRecipients.map(r => ({
          email: r.email,
          name: r.name,
          isExternal: true,
        })),
      ];
      this.mailingService.sendSurvey({
        surveyId: this.selectedSurvey.id,
        subject: this.subject,
        surveyBodyHtml: this.bodyHtml + this.surveyCtaHtml(),
        closingDate: (this.selectedSurvey as any).closingDate,
        recipients: recipientPayload,
        copyRecipients: copyRecipientPayload,
        attachments: this.attachments.length > 0 ? this.attachments : undefined,
        onProgress: progress => this.mailingProgress = progress,
      }).then(res => {
        this.result = res;
        this.sending = false;
        this.mailingProgress = null;
      }).catch(err => {
        this.error = err?.message || "Erreur lors de l'envoi du sondage";
        this.sending = false;
        this.mailingProgress = null;
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
      recipientDetails: [
        ...this.recipients.map(m => ({
          email: (m.email ?? '').trim().toLowerCase(),
          name: `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim(),
          memberId: m.id,
          isExternal: false,
        })),
        ...this.externalRecipients.map(r => ({
          email: r.email,
          name: r.name,
          isExternal: true,
        })),
      ],
      copyRecipients: [
        ...this.copyRecipients.map(m => ({
          email: (m.email ?? '').trim().toLowerCase(),
          name: `${m.firstname ?? ''} ${m.lastname ?? ''}`.trim(),
          memberId: m.id,
          isExternal: false,
        })),
        ...this.externalCopyRecipients.map(r => ({
          email: r.email,
          name: r.name,
          isExternal: true,
        })),
      ],
      subject: this.subject,
      bodyHtml: this.bodyHtml,
      attachments: this.attachments.length > 0 ? this.attachments : undefined,
      onProgress: progress => this.mailingProgress = progress,
    };
    this.mailingService.sendEmail(emailParams)
      .then((res) => {
        this.result = res;
        this.skippedRecipients = res.skippedRecipients || [];
        this.sending = false;
        this.mailingProgress = null;
        this.resetForm();
      })
      .catch((err) => {
        this.error = err?.message || "Erreur lors de l'envoi";
        this.sending = false;
        this.mailingProgress = null;
      });
  }
}
