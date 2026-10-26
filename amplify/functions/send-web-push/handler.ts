import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import webPush, { type RequestOptions, type WebPushError } from 'web-push';
import type { Schema } from '../../data/resource';

type Handler = Schema['sendWebPush']['functionHandler'];
type NotificationTopic = 'news' | 'partner' | 'alerts';

export type PushSubscriptionItem = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: number | null;
  news: boolean;
  partner: boolean;
  alerts: boolean;
};

type PushPayload = {
  notification: {
    title: string;
    body: string;
    tag: string;
    data: { url: string };
  };
};

type PushTransport = {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: webPush.PushSubscription,
    payload: string,
    options: RequestOptions,
  ): Promise<webPush.SendResult>;
};

type PushFailure = {
  subscriptionId: string;
  statusCode?: number;
  error: string;
};

export type PushSendResult = {
  selected: number;
  sent: number;
  expired: number;
  failed: number;
  failures: PushFailure[];
};

type ValidatedRequest = {
  topic: NotificationTopic;
  title: string;
  body: string;
  url: string;
  subscriptionId?: string;
};

const SEND_CONCURRENCY = 10;
const PUSH_TTL_SECONDS = 24 * 60 * 60;
const TOPICS = new Set<NotificationTopic>(['news', 'partner', 'alerts']);

export const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const ssmClient = new SSMClient({});

let vapidConfigurationPromise:
  | Promise<{ subject: string; publicKey: string; privateKey: string }>
  | undefined;

function requiredTrimmedString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${field} must not exceed ${maxLength} characters`);
  }
  return trimmed;
}

export function validateSendWebPushRequest(
  input: Record<string, unknown>,
): ValidatedRequest {
  const topic = requiredTrimmedString(input['topic'], 'topic', 20);
  if (!TOPICS.has(topic as NotificationTopic)) {
    throw new Error('topic must be news, partner or alerts');
  }

  const url = requiredTrimmedString(input['url'], 'url', 512);
  if (!url.startsWith('/') || url.startsWith('//')) {
    throw new Error('url must be an internal absolute path');
  }

  const subscriptionId = typeof input['subscriptionId'] === 'string'
    ? input['subscriptionId'].trim()
    : '';
  if (subscriptionId.length > 128) {
    throw new Error('subscriptionId must not exceed 128 characters');
  }

  return {
    topic: topic as NotificationTopic,
    title: requiredTrimmedString(input['title'], 'title', 80),
    body: requiredTrimmedString(input['body'], 'body', 240),
    url,
    subscriptionId: subscriptionId || undefined,
  };
}

function statusCodeFromError(error: unknown): number | undefined {
  const statusCode = (error as Partial<WebPushError> | undefined)?.statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await operation(values[currentIndex]);
      }
    },
  );
  await Promise.all(workers);
}

export async function sendPushBatch(
  subscriptions: PushSubscriptionItem[],
  payload: PushPayload,
  transport: Pick<PushTransport, 'sendNotification'>,
  removeSubscription: (subscriptionId: string) => Promise<void>,
): Promise<PushSendResult> {
  const result: PushSendResult = {
    selected: subscriptions.length,
    sent: 0,
    expired: 0,
    failed: 0,
    failures: [],
  };
  const serializedPayload = JSON.stringify(payload);

  await mapWithConcurrency(subscriptions, SEND_CONCURRENCY, async (subscription) => {
    try {
      await transport.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime ?? null,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        serializedPayload,
        {
          TTL: PUSH_TTL_SECONDS,
          urgency: 'normal',
          topic: payload.notification.tag,
        },
      );
      result.sent += 1;
    } catch (error) {
      const statusCode = statusCodeFromError(error);
      if (statusCode === 404 || statusCode === 410) {
        try {
          await removeSubscription(subscription.id);
          result.expired += 1;
          return;
        } catch (deleteError) {
          result.failed += 1;
          result.failures.push({
            subscriptionId: subscription.id,
            statusCode,
            error: `Push expired but cleanup failed: ${messageFromError(deleteError)}`,
          });
          return;
        }
      }

      result.failed += 1;
      result.failures.push({
        subscriptionId: subscription.id,
        statusCode,
        error: messageFromError(error),
      });
    }
  });

  return result;
}

async function loadVapidConfiguration(): Promise<{
  subject: string;
  publicKey: string;
  privateKey: string;
}> {
  if (vapidConfigurationPromise) {
    return vapidConfigurationPromise;
  }

  vapidConfigurationPromise = (async () => {
    const subjectParameter = process.env['WEB_PUSH_VAPID_SUBJECT_PARAMETER'];
    const publicKeyParameter = process.env['WEB_PUSH_VAPID_PUBLIC_KEY_PARAMETER'];
    const privateKeyParameter = process.env['WEB_PUSH_VAPID_PRIVATE_KEY_PARAMETER'];
    const names = [subjectParameter, publicKeyParameter, privateKeyParameter];
    if (names.some(name => !name)) {
      throw new Error('Missing VAPID parameter configuration');
    }

    const response = await ssmClient.send(new GetParametersCommand({
      Names: names as string[],
      WithDecryption: true,
    }));
    const values = new Map(
      response.Parameters?.map(parameter => [parameter.Name, parameter.Value]) ?? [],
    );
    const invalid = response.InvalidParameters ?? [];
    if (invalid.length > 0) {
      throw new Error(`Missing VAPID parameters: ${invalid.join(', ')}`);
    }

    const subject = values.get(subjectParameter!);
    const publicKey = values.get(publicKeyParameter!);
    const privateKey = values.get(privateKeyParameter!);
    if (!subject || !publicKey || !privateKey) {
      throw new Error('One or more VAPID parameters are empty');
    }
    return { subject, publicKey, privateKey };
  })();

  try {
    return await vapidConfigurationPromise;
  } catch (error) {
    vapidConfigurationPromise = undefined;
    throw error;
  }
}

async function listSubscriptions(
  tableName: string,
  topic: NotificationTopic,
  subscriptionId?: string,
): Promise<PushSubscriptionItem[]> {
  if (subscriptionId) {
    const response = await documentClient.send(new GetCommand({
      TableName: tableName,
      Key: { id: subscriptionId },
    }));
    const item = response.Item as PushSubscriptionItem | undefined;
    return item?.[topic] === true ? [item] : [];
  }

  const subscriptions: PushSubscriptionItem[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const response = await documentClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: '#topic = :enabled',
      ExpressionAttributeNames: { '#topic': topic },
      ExpressionAttributeValues: { ':enabled': true },
      ProjectionExpression:
        'id, endpoint, p256dh, auth, expirationTime, news, partner, alerts',
      ExclusiveStartKey: exclusiveStartKey,
    }));
    subscriptions.push(...(response.Items as PushSubscriptionItem[] ?? []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return subscriptions;
}

export const handler: Handler = async (event) => {
  const request = validateSendWebPushRequest(
    event.arguments as Record<string, unknown>,
  );
  const tableName = process.env['PUSH_SUBSCRIPTION_TABLE_NAME'];
  if (!tableName) {
    throw new Error('Missing PUSH_SUBSCRIPTION_TABLE_NAME');
  }

  const vapid = await loadVapidConfiguration();
  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const subscriptions = await listSubscriptions(
    tableName,
    request.topic,
    request.subscriptionId,
  );
  const payload: PushPayload = {
    notification: {
      title: request.title,
      body: request.body,
      tag: `bcsto-${request.topic}`,
      data: { url: request.url },
    },
  };
  const result = await sendPushBatch(
    subscriptions,
    payload,
    webPush,
    async subscriptionId => {
      await documentClient.send(new DeleteCommand({
        TableName: tableName,
        Key: { id: subscriptionId },
      }));
    },
  );

  console.info('[WebPush] Send completed', {
    topic: request.topic,
    targetedSubscription: !!request.subscriptionId,
    selected: result.selected,
    sent: result.sent,
    expired: result.expired,
    failed: result.failed,
  });
  return result;
};
