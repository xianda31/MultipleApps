

import { Component } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MailingApiService } from '../services/mailing-api.service';

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

  constructor(private mailingApi: MailingApiService) {
    console.log('MailingComponent initialized');
  }

  sendMail() {
    this.sending = true;
    this.result = null;
    this.error = null;
    // Prend la première ligne, sépare par virgule, filtre les emails valides uniquement
    const toField = this.toList.split(/\r?\n/)[0];
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const toArray = toField
      .split(',')
      .map(e => e.trim())
      .filter(email => emailRegex.test(email));
    if (toArray.length === 0) {
      this.error = 'Aucune adresse email valide trouvée.';
      this.sending = false;
      return;
    }
    this.mailingApi.sendEmail({
      from: this.from,
      to: toArray,
      subject: this.subject,
      bodyText: this.body
    })
      .then((res) => {
        this.result = res;
        this.sending = false;
      })
      .catch((err) => {
        this.error = err?.error?.error || err.message || 'Erreur lors de l\'envoi';
        this.sending = false;
      });
  }
}
