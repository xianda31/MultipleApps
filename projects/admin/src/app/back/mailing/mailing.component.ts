import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MailingService, SendEmailParams } from './mailing.service';
import { MembersService } from '../../common/services/members.service';
import { Member } from '../../common/interfaces/member.interface';

@Component({
  selector: 'app-mailing.component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mailing.component.html',
  styleUrl: './mailing.component.scss'
})

export class MailingComponent implements OnInit, AfterViewInit {
  @ViewChild('editorDiv') editorDiv!: ElementRef<HTMLDivElement>;
  
  recipientMode: 'all' | 'selected' = 'all'; // Mode de sélection
  members: Member[] = [];
  memberSelection: Map<string, boolean> = new Map(); // Map pour stocker les sélections
  selectedMembers: string[] = []; // IDs des membres sélectionnés
  toList = '';
  subject = '';
  bodyHtml = ''; // Contenu HTML
  sending = false;
  result: any = null;
  error: string | null = null;
  skippedRecipients: string[] = [];
  attachments: Array<{filename: string, content: string, contentType: string}> = [];

  constructor(
    private mailingService: MailingService,
    private membersService: MembersService
  ) {
    console.log('MailingComponent initialized');
  }

  ngOnInit() {
    // Charger la liste des membres avec email valide (contient @ et pas de ?)
    this.membersService.listMembers().subscribe(members => {
      this.members = members.filter(m => m.email && m.email.includes('@') && !m.email.includes('?'));
    });
  }

  ngAfterViewInit() {
    // Initialiser le contenu de l'éditeur si nécessaire
    if (this.editorDiv && this.bodyHtml) {
      this.editorDiv.nativeElement.innerHTML = this.bodyHtml;
    }
  }

  // Compter les membres qui acceptent les mailings
  getActiveMailingCount(): number {
    return this.members.filter(m => m.accept_mailing).length;
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
    return this.mailingService.buildEmailTemplate(this.bodyHtml);
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

  openMailPreview() {
    let fullBodyHtml = this.mailingService.buildEmailTemplate(this.bodyHtml);
    
    // Ajouter les pièces jointes si présentes
    if (this.attachments.length > 0) {
      const attachmentsList = this.attachments
        .map(att => `<li>${att.filename}</li>`)
        .join('');
      const attachmentsSection = `
        <div style="margin-top: 20px; padding: 15px; background-color: #f0f0f0; border-left: 4px solid #667eea;">
          <strong>Pièces jointes (${this.attachments.length}) :</strong>
          <ul style="margin: 10px 0; padding-left: 20px;">
            ${attachmentsList}
          </ul>
        </div>
      `;
      fullBodyHtml = fullBodyHtml.replace('</body>', attachmentsSection + '</body>');
    }
    
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(fullBodyHtml);
      newWindow.document.close();
    }
  }

  resetForm() {
    this.subject = '';
    this.bodyHtml = '';
    this.attachments = [];
    this.selectedMembers = [];
    this.memberSelection.clear();
    this.recipientMode = 'all';
    if (this.editorDiv) {
      this.editorDiv.nativeElement.innerHTML = '';
    }
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
        this.openMailPreview();
        this.resetForm();
      })
      .catch((err) => {
        this.error = err?.message || 'Erreur lors de l\'envoi';
        this.sending = false;
      });
  }
}
