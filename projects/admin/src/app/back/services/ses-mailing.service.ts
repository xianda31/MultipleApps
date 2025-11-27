import { Injectable } from '@angular/core';
// @ts-ignore
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SesMailingService {
  private sesClient: SESClient;

  constructor() {
    this.sesClient = new SESClient({
      region: environment.region, 
      credentials: {
        accessKeyId: environment.aws_access_key_id, 
        secretAccessKey: environment.aws_secret_access_key,
      },
    });
  }

  async sendBulkEmail({
    from,
    toList,
    subject,
    bodyText,
    bodyHtml,
  }: {
    from: string;
    toList: string[];
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
  }): Promise<any[]> {
    // SES limite à 50 destinataires par appel
    const chunkSize = 50;
    const results = [];
    for (let i = 0; i < toList.length; i += chunkSize) {
      const chunk = toList.slice(i, i + chunkSize);
      const params = {
        Source: from,
        Destination: { ToAddresses: chunk },
        Message: {
          Subject: { Data: subject },
          Body: bodyHtml
            ? { Html: { Data: bodyHtml } }
            : { Text: { Data: bodyText || '' } },
        },
      };
      const result = await this.sesClient.send(new SendEmailCommand(params));
      results.push(result);
    }
    return results;
  }
}
