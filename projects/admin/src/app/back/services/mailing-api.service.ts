// Angular service example to call the backend SES relay endpoint

import { Injectable } from '@angular/core';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';

export interface MailingProgress {
  state: 'queued' | 'sending';
  sentCount: number;
  totalRecipients: number;
}

@Injectable({ providedIn: 'root' })
export class MailingApiService {
  constructor() {}

  async sendEmail(payload: {
    from: string;
    to: string[];
    recipientDetails?: Array<{ email: string; name: string; memberId?: string; isExternal?: boolean }>;
    copyRecipients?: Array<{ email: string; name: string; memberId?: string; isExternal?: boolean }>;
    cc?: string[];
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
    attachments?: Array<{filename: string, content: string, contentType: string}>;
    replyTo?: string;
  }, onProgress?: (progress: MailingProgress) => void): Promise<any> {
    try {
      return await this.sendEmailRequest(payload, onProgress);
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
    copyRecipients?: Array<{ email: string; name: string; memberId?: string; isExternal?: boolean }>;
    from?: string;
    cc?: string[];
    replyTo?: string;
    baseUrl?: string;
    attachments?: Array<{filename: string, content: string, contentType: string}>;
  }, onProgress?: (progress: MailingProgress) => void): Promise<any> {
    try {
      return await this.sendEmailRequest(payload, onProgress);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du sondage:', error);
      throw error;
    }
  }

  private async sendEmailRequest(
    payload: object,
    onProgress?: (progress: MailingProgress) => void,
  ): Promise<any> {
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
    const responseBody = await response.json().catch(() => null) as {
      error?: string;
      queued?: boolean;
      jobId?: string;
      totalRecipients?: number;
    } | null;

    if (!response.ok) {
      throw new Error(responseBody?.error || `Erreur du service de mailing (${response.status})`);
    }

    if (responseBody?.queued && responseBody.jobId) {
      onProgress?.({
        state: 'queued',
        sentCount: 0,
        totalRecipients: responseBody.totalRecipients || 0,
      });
      return this.waitForMailingJob(endpoint, idToken, responseBody.jobId, onProgress);
    }

    return responseBody;
  }

  private async waitForMailingJob(
    endpoint: string,
    idToken: string,
    jobId: string,
    onProgress?: (progress: MailingProgress) => void,
  ): Promise<any> {
    const statusUrl = `${endpoint.replace(/\/$/, '')}/api/send-email/status/${encodeURIComponent(jobId)}`;

    for (let attempt = 0; attempt < 480; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const response = await fetch(statusUrl, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const status = await response.json().catch(() => null) as {
        state?: 'queued' | 'sending' | 'completed' | 'failed';
        sentCount?: number;
        totalRecipients?: number;
        result?: unknown;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(status?.error || `Impossible de consulter l'état du mailing (${response.status})`);
      }
      if (status?.state === 'queued' || status?.state === 'sending') {
        onProgress?.({
          state: status.state,
          sentCount: status.sentCount || 0,
          totalRecipients: status.totalRecipients || 0,
        });
      }
      if (status?.state === 'completed') {
        return status.result;
      }
      if (status?.state === 'failed') {
        throw new Error(status.error || 'Le traitement du mailing a échoué.');
      }
    }

    throw new Error('Le mailing est toujours en cours après 16 minutes. Consultez les journaux avant de le relancer.');
  }
}
