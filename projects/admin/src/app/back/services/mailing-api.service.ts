// Angular service example to call the backend SES relay endpoint

import { Injectable } from '@angular/core';
import { post } from 'aws-amplify/api';

@Injectable({ providedIn: 'root' })
export class MailingApiService {
  constructor() {}

  async sendEmail(payload: {
    from: string;
    to: string[];
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
  }): Promise<any> {
    try {
      const restOperation = post({
        apiName: 'ffbProxyApi',
        path: '/api/send-email',
        options: { body: payload }
      });
      const { body } = await restOperation.response;
      return await body.json();
    } catch (error) {
      console.error('Erreur lors de l\'envoi du mail:', error);
      throw error;
    }
  }
}
