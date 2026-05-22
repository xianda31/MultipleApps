// Angular service example to call the backend SES relay endpoint

import { Injectable } from '@angular/core';
import { post } from 'aws-amplify/api';
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
      // Récupérer la session pour s'assurer que l'utilisateur est authentifié
      const session = await fetchAuthSession();
      
      const restOperation = post({
        apiName: 'ffbProxyApi',
        path: '/api/send-email',
        options: { 
          body: payload,
          headers: {
            Authorization: `Bearer ${session.tokens?.idToken?.toString()}`
          }
        }
      });
      const { body } = await restOperation.response;
      return await body.json();
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
    recipients: Array<{ email: string; name: string; memberId: string }>;
    from?: string;
    baseUrl?: string;
    attachments?: Array<{filename: string, content: string, contentType: string}>;
  }): Promise<any> {
    try {
      const session = await fetchAuthSession();
      const restOperation = post({
        apiName: 'ffbProxyApi',
        path: '/api/send-email',
        options: {
          body: payload as any,
          headers: { Authorization: `Bearer ${session.tokens?.idToken?.toString()}` },
        },
      });
      const { body } = await restOperation.response;
      return await body.json();
    } catch (error) {
      console.error('Erreur lors de l\'envoi du sondage:', error);
      throw error;
    }
  }
}
