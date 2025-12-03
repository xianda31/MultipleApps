import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MailingApiService } from '../services/mailing-api.service';
import { EmailTemplateService } from '../services/email-template.service';
import { MembersService } from '../../common/services/members.service';
import { Member } from '../../common/interfaces/member.interface';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mailing.component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mailing.component.html',
  styleUrl: './mailing.component.scss'
})

export class MailingComponent implements OnInit, AfterViewInit {
  @ViewChild('editorDiv') editorDiv!: ElementRef<HTMLDivElement>;
  
  from = '"Bridge Club Saint-Orens" <noreply@bridgeclubsaintorens.fr>';
  recipientMode: 'all' | 'selected' = 'all'; // Mode de sélection
  members: Member[] = [];
  memberSelection: Map<string, boolean> = new Map(); // Map pour stocker les sélections
  selectedMembers: string[] = []; // IDs des membres sélectionnés
  toList = '';
  ccEmail = environment.mailingCcEmail; // Email en copie depuis environment
  subject = '';
  bodyHtml = ''; // Contenu HTML
  sending = false;
  result: any = null;
  error: string | null = null;
  skippedRecipients: string[] = [];
  attachments: Array<{filename: string, content: string, contentType: string}> = [];

  constructor(
    private mailingApi: MailingApiService,
    private emailTemplate: EmailTemplateService,
    private membersService: MembersService
  ) {
    console.log('MailingComponent initialized');
  }

  ngOnInit() {
    // Charger la liste des membres avec email ET qui acceptent les mailings
    this.membersService.listMembers().subscribe(members => {
      this.members = members.filter(m => m.email && m.accept_mailing);
    });
  }

  ngAfterViewInit() {
    // Initialiser le contenu de l'éditeur si nécessaire
    if (this.editorDiv && this.bodyHtml) {
      this.editorDiv.nativeElement.innerHTML = this.bodyHtml;
    }
  }

  // Gérer la sélection/désélection de membres
  onMemberSelectionChange(member: Member) {
    const isSelected = this.memberSelection.get(member.id) || false;
    if (isSelected) {
      if (!this.selectedMembers.includes(member.id)) {
        this.selectedMembers.push(member.id);
      }
    } else {
      this.selectedMembers = this.selectedMembers.filter(id => id !== member.id);
    }
  }

  // Vérifier si un membre est sélectionné
  isMemberSelected(memberId: string): boolean {
    return this.memberSelection.get(memberId) || false;
  }

  // Basculer la sélection d'un membre
  toggleMemberSelection(memberId: string) {
    const currentValue = this.memberSelection.get(memberId) || false;
    this.memberSelection.set(memberId, !currentValue);
    if (!currentValue) {
      this.selectedMembers.push(memberId);
    } else {
      this.selectedMembers = this.selectedMembers.filter(id => id !== memberId);
    }
  }

  // Méthode pour prévisualiser le template complet
  getFullPreview(): string {
    return this.emailTemplate.buildEmailTemplate(this.bodyHtml);
  }

  // Méthode appelée lors de la modification de l'éditeur contenteditable
  onContentChange(event: Event): void {
    const element = event.target as HTMLElement;
    this.bodyHtml = element.innerHTML;
  }

  // Appliquer un formatage au texte sélectionné
  formatText(command: string, value?: string): void {
    document.execCommand(command, false, value);
    // Mettre le focus sur l'éditeur après le formatage
    this.editorDiv?.nativeElement.focus();
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]; // Retirer le préfixe data:xxx;base64,
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

  sendMail() {
    this.sending = true;
    this.result = null;
    this.error = null;
    this.skippedRecipients = [];
    
    let toArray: string[] = [];
    
    if (this.recipientMode === 'all') {
      // Tous les membres avec email ET qui acceptent les mails
      toArray = this.members
        .filter(m => m.email && m.accept_mailing)
        .map(m => m.email) as string[];
    } else {
      // Membres sélectionnés manuellement (vérifier aussi accept_mailing)
      toArray = this.selectedMembers
        .map(id => this.members.find(m => m.id === id))
        .filter(m => m && m.email && m.accept_mailing)
        .map(m => m!.email) as string[];
    }
    
    if (toArray.length === 0) {
      this.error = 'Aucun destinataire sélectionné.';
      this.sending = false;
      return;
    }
    
    this.mailingApi.sendEmail({
      from: this.from,
      to: toArray,
      cc: this.ccEmail ? [this.ccEmail] : undefined,
      subject: this.subject,
      bodyHtml: this.emailTemplate.buildEmailTemplate(this.bodyHtml),
      attachments: this.attachments.length > 0 ? this.attachments : undefined
    })
      .then((res) => {
        this.result = res;
        this.skippedRecipients = res.skippedRecipients || [];
        this.sending = false;
      })
      .catch((err) => {
        this.error = err?.error?.error || err.message || 'Erreur lors de l\'envoi';
        this.sending = false;
      });
  }
}
