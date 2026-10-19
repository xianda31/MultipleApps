import {
  hashPushEndpoint,
  mapPushSubscription,
  persistPushSubscription,
  PushSubscriptionModel,
  PushSubscriptionRecord,
  urlBase64ToUint8Array,
} from './notification-subscription-demo.service';

describe('NotificationSubscriptionService utilities', () => {
  const record: PushSubscriptionRecord = {
    id: 'subscription-id',
    endpoint: 'https://push.example/subscription',
    p256dh: 'p256dh-key',
    auth: 'auth-key',
    expirationTime: null,
    news: true,
    partner: false,
    alerts: true,
    userAgent: 'test',
    firstSubscribedAt: '2026-01-01T10:00:00.000Z',
    lastSeenAt: '2026-01-02T10:00:00.000Z',
  };

  it('converts the public VAPID key to its 65-byte representation', () => {
    const key = urlBase64ToUint8Array(
      'BM3qKGELWR_u1ALXTEfNwzkECHUgiQqXVirfNirtFJ0zFdC3a-_ICYhqxo9ArhHiNLg4b_aqteQdb4gHnSCP_J8',
    );

    expect(key.length).toBe(65);
    expect(key[0]).toBe(4);
  });

  it('derives a deterministic identifier from the endpoint', async () => {
    const endpoint = 'https://push.example/subscription';

    const first = await hashPushEndpoint(endpoint);
    const second = await hashPushEndpoint(endpoint);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashPushEndpoint(`${endpoint}-other`)).not.toBe(first);
  });

  it('maps the browser subscription and selected topics', async () => {
    const subscription = {
      endpoint: record.endpoint,
      expirationTime: null,
      toJSON: () => ({
        endpoint: record.endpoint,
        expirationTime: null,
        keys: { p256dh: record.p256dh, auth: record.auth },
      }),
    } as unknown as PushSubscription;

    const mapped = await mapPushSubscription(
      subscription,
      ['news', 'alerts'],
      record.firstSubscribedAt,
      record.lastSeenAt,
    );

    expect(mapped).toEqual(jasmine.objectContaining({
      endpoint: record.endpoint,
      p256dh: record.p256dh,
      auth: record.auth,
      news: true,
      partner: false,
      alerts: true,
      firstSubscribedAt: record.firstSubscribedAt,
      lastSeenAt: record.lastSeenAt,
    }));
  });

  it('creates a new backend subscription', async () => {
    const model = createModel();

    await persistPushSubscription(model, record, false);

    expect(model.create).toHaveBeenCalledOnceWith(record);
    expect(model.update).not.toHaveBeenCalled();
  });

  it('updates a known backend subscription without replacing its creation date', async () => {
    const model = createModel();

    await persistPushSubscription(model, record, true);

    expect(model.create).not.toHaveBeenCalled();
    expect(model.update).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ id: record.id, lastSeenAt: record.lastSeenAt }),
    );
    expect(model.update).not.toHaveBeenCalledWith(
      jasmine.objectContaining({ firstSubscribedAt: jasmine.any(String) }),
    );
  });

  it('updates the deterministic record when create reports a duplicate', async () => {
    const model = createModel();
    model.create.and.resolveTo({
      errors: [{ message: 'The conditional request failed' }],
    });

    await persistPushSubscription(model, record, false);

    expect(model.update).toHaveBeenCalledTimes(1);
  });

  function createModel(): jasmine.SpyObj<PushSubscriptionModel> {
    const model = jasmine.createSpyObj<PushSubscriptionModel>(
      'PushSubscriptionModel',
      ['create', 'update', 'delete'],
    );
    model.create.and.resolveTo({});
    model.update.and.resolveTo({});
    model.delete.and.resolveTo({});
    return model;
  }
});
