import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../../amplify/data/resource';
import { NotificationTopic } from '../../front/front/pages/home-page/notification-subscription/notification-subscription.service';

export interface WebPushSendRequest {
  topic: NotificationTopic;
  title: string;
  body: string;
  url: string;
  subscriptionId?: string;
}

export interface WebPushFailure {
  subscriptionId: string;
  statusCode?: number;
  error: string;
}

export interface WebPushSendResult {
  selected: number;
  sent: number;
  expired: number;
  failed: number;
  failures: WebPushFailure[];
}

export function parseWebPushSendResult(value: unknown): WebPushSendResult {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Le serveur Web Push a retourné un bilan invalide.');
  }

  const result = parsed as Partial<WebPushSendResult>;
  if (
    !Number.isInteger(result.selected)
    || !Number.isInteger(result.sent)
    || !Number.isInteger(result.expired)
    || !Number.isInteger(result.failed)
    || !Array.isArray(result.failures)
  ) {
    throw new Error('Le serveur Web Push a retourné un bilan incomplet.');
  }

  return result as WebPushSendResult;
}

@Injectable({ providedIn: 'root' })
export class WebPushAdminService {
  async send(request: WebPushSendRequest): Promise<WebPushSendResult> {
    const client = generateClient<Schema>({ authMode: 'userPool' });
    const { data, errors } = await client.mutations.sendWebPush(request);
    if (errors?.length) {
      throw new Error(errors.map(error => error.message).join(', '));
    }
    return parseWebPushSendResult(data);
  }
}
