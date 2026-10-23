import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type PushSubscriptionItem,
  sendPushBatch,
  validateSendWebPushRequest,
} from './handler';

const payload = {
  notification: {
    title: 'Nouvelle actualité',
    body: 'Les résultats sont disponibles.',
    tag: 'bcsto-news',
    data: { url: '/front/actualites' },
  },
};

function subscription(id: string): PushSubscriptionItem {
  return {
    id,
    endpoint: `https://push.example/${id}`,
    p256dh: `p256dh-${id}`,
    auth: `auth-${id}`,
    expirationTime: null,
    news: true,
    partner: false,
    alerts: false,
  };
}

describe('send web push', () => {
  it('validates and normalizes an internal notification request', () => {
    assert.deepEqual(
      validateSendWebPushRequest({
        topic: ' news ',
        title: ' Nouvelle actualité ',
        body: ' Les résultats sont disponibles. ',
        url: ' /front/actualites ',
        subscriptionId: ' subscription-1 ',
      }),
      {
        topic: 'news',
        title: 'Nouvelle actualité',
        body: 'Les résultats sont disponibles.',
        url: '/front/actualites',
        subscriptionId: 'subscription-1',
      },
    );
  });

  it('rejects an external target URL', () => {
    assert.throws(
      () => validateSendWebPushRequest({
        topic: 'news',
        title: 'Titre',
        body: 'Message',
        url: 'https://example.com/phishing',
      }),
      /url must be an internal absolute path/,
    );
  });

  it('reports successful notifications without deleting subscriptions', async () => {
    const sentEndpoints: string[] = [];
    const deletedIds: string[] = [];
    const result = await sendPushBatch(
      [subscription('one'), subscription('two')],
      payload,
      {
        async sendNotification(target) {
          sentEndpoints.push(target.endpoint);
          return { statusCode: 201, body: '', headers: {} };
        },
      },
      async id => {
        deletedIds.push(id);
      },
    );

    assert.equal(result.selected, 2);
    assert.equal(result.sent, 2);
    assert.equal(result.expired, 0);
    assert.equal(result.failed, 0);
    assert.equal(sentEndpoints.length, 2);
    assert.deepEqual(deletedIds, []);
  });

  it('deletes subscriptions rejected with HTTP 404 or 410', async () => {
    const deletedIds: string[] = [];
    const result = await sendPushBatch(
      [subscription('gone')],
      payload,
      {
        async sendNotification() {
          throw Object.assign(new Error('subscription expired'), { statusCode: 410 });
        },
      },
      async id => {
        deletedIds.push(id);
      },
    );

    assert.equal(result.sent, 0);
    assert.equal(result.expired, 1);
    assert.equal(result.failed, 0);
    assert.deepEqual(deletedIds, ['gone']);
  });

  it('reports temporary failures without deleting the subscription', async () => {
    const deletedIds: string[] = [];
    const result = await sendPushBatch(
      [subscription('temporary-failure')],
      payload,
      {
        async sendNotification() {
          throw Object.assign(new Error('service unavailable'), { statusCode: 503 });
        },
      },
      async id => {
        deletedIds.push(id);
      },
    );

    assert.equal(result.sent, 0);
    assert.equal(result.expired, 0);
    assert.equal(result.failed, 1);
    assert.equal(result.failures[0]?.statusCode, 503);
    assert.deepEqual(deletedIds, []);
  });
});
