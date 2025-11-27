

import { Component } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SesMailingService } from '../services/ses-mailing.service';

@Component({
  selector: 'app-mailing.component',
  standalone: true,
  imports: [CommonModule, FormsModule, JsonPipe],
  templateUrl: './mailing.component.html',
  styleUrl: './mailing.component.scss'
})

export class MailingComponent {
  from = '';
  toList = '';
  subject = '';
  body = '';
  sending = false;
  result: any = null;
  error: string | null = null;

  constructor(private sesMailing: SesMailingService) {}

  async sendMail() {
    this.sending = true;
    this.result = null;
    this.error = null;
    try {
      // Prend la première ligne, sépare par virgule, filtre les emails valides uniquement
      const toField = this.toList.split(/\r?\n/)[0];
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      const toArray = toField
        .split(',')
        .map(e => e.trim())
        .filter(email => emailRegex.test(email));
      console.log('Destinataires envoyés à SES:', toArray);
      if (toArray.length === 0) {
        this.error = 'Aucune adresse email valide trouvée.';
        this.sending = false;
        return;
      }
      this.result = await this.sesMailing.sendBulkEmail({
        from: this.from,
        toList: toArray,
        subject: this.subject,
        bodyText: this.body
      });
    } catch (e: any) {
      this.error = e.message || 'Erreur lors de l\'envoi';
    } finally {
      this.sending = false;
    }
  }
}
