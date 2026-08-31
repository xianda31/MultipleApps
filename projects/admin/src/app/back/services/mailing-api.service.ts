// Angular service example to call the backend SES relay endpoint

import { Injectable } from '@angular/core';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';

@Injectable({ providedIn: 'root' })
export class MailingApiService {
  constructor() {}

  async sendEmail(payload: {
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
    attachments?: Array<{filename: string, content: string, contentType: string}>;
    replyTo?: string;
  }): Promise<any> {
    try {
      return await this.sendEmailRequest(payload);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du mail:', error);
      throw error;
    }
  }

  async sendSurvey(payload: {
    surveyId: string;
    subject: string;
    emailTemplate: string;
    closingDate?: string;
    recipients: Array<{ email: string; name: string; memberId?: string; isExternal?: boolean }>;
    from?: string;
    cc?: string[];
    baseUrl?: string;
    attachments?: Array<{filename: string, content: string, contentType: string}>;
  }): Promise<any> {
    try {
      return await this.sendEmailRequest(payload);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du sondage:', error);
      throw error;
    }
  }

  private async sendEmailRequest(payload: object): Promise<any> {
    const endpoint = Amplify.getConfig().API?.REST?.['ffbProxyApi']?.endpoint;
    if (!endpoint) {
      throw new Error('Endpoint du service de mailing non configuré');
    }

    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) {
      throw new Error('Session utilisateur expirée');
    }

    const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const responseBody = await response.json().catch(() => null) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(responseBody?.error || `Erreur du service de mailing (${response.status})`);
    }

    return responseBody;
  }
}
