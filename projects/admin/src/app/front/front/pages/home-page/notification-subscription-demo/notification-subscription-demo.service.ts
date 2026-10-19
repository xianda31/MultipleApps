import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { BehaviorSubject } from 'rxjs';
import { Schema } from '../../../../../../../../../amplify/data/resource';
import { WEB_PUSH_CONFIG } from '../../../../../common/config/web-push.config';

export type NotificationTopic = 'news' | 'partner' | 'alerts';
export type NotificationDecision = 'accepted' | 'later' | 'declined';

export interface NotificationPreferences {
  decision: NotificationDecision;
  topics: NotificationTopic[];
  subscriptionId?: string;
  firstSubscribedAt?: string;
  updatedAt: string;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: number | null;
  news: boolean;
  partner: boolean;
  alerts: boolean;
  userAgent: string;
  firstSubscribedAt: string;
  lastSeenAt: string;
}

export interface PushSubscriptionModel {
  create(input: PushSubscriptionRecord): Promise<{ errors?: readonly { message: string }[] }>;
  update(input: Omit<PushSubscriptionRecord, 'firstSubscribedAt'>): Promise<{
    errors?: readonly { message: string }[];
  }>;
  delete(input: { id: string }): Promise<{ errors?: readonly { message: string }[] }>;
}

const STORAGE_KEY = 'bcsto.pushNotification.preference';
const LEGACY_STORAGE_KEY = 'bcsto.pushNotificationDemo.preference';
const PUSH_WORKER_PATH = '/push/notification-sw.js';
const PUSH_WORKER_SCOPE = '/push/';

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

export async function hashPushEndpoint(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest))
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function mapPushSubscription(
  subscription: PushSubscription,
  topics: NotificationTopic[],
  firstSubscribedAt: string,
  now = new Date().toISOString(),
): Promise<PushSubscriptionRecord> {
  const keys = subscription.toJSON().keys;
  if (!keys?.['p256dh'] || !keys['auth']) {
    throw new Error('Les clés de l’abonnement Push sont incomplètes.');
  }

  return {
    id: await hashPushEndpoint(subscription.endpoint),
    endpoint: subscription.endpoint,
    p256dh: keys['p256dh'],
    auth: keys['auth'],
    expirationTime: subscription.expirationTime,
    news: topics.includes('news'),
    partner: topics.includes('partner'),
    alerts: topics.includes('alerts'),
    userAgent: navigator.userAgent,
    firstSubscribedAt,
    lastSeenAt: now,
  };
}

function throwIfPushErrors(
  errors: readonly { message: string }[] | undefined,
  action: string,
): void {
  if (errors?.length) {
    throw new Error(`Impossible de ${action} : ${errors.map(error => error.message).join(', ')}`);
  }
}

export async function persistPushSubscription(
  model: PushSubscriptionModel,
  record: PushSubscriptionRecord,
  knownSubscription: boolean,
): Promise<void> {
  const { firstSubscribedAt, ...update } = record;
  if (knownSubscription) {
    const { errors } = await model.update(update);
    throwIfPushErrors(errors, 'mettre à jour l’abonnement');
    return;
  }

  const { errors } = await model.create(record);
  if (!errors?.length) {
    return;
  }
  if (!errors.some(error => String(error.message).toLowerCase().includes('conditional'))) {
    throwIfPushErrors(errors, 'créer l’abonnement');
  }

  const updateResult = await model.update(update);
  throwIfPushErrors(updateResult.errors, 'mettre à jour l’abonnement existant');
}

@Injectable({ providedIn: 'root' })
export class NotificationSubscriptionService {
  private readonly preferencesSubject = new BehaviorSubject<NotificationPreferences>(
    this.readPreferences(),
  );

  readonly preferences$ = this.preferencesSubject.asObservable();

  get preferences(): NotificationPreferences {
    return this.preferencesSubject.value;
  }

  get isSupported(): boolean {
    return typeof window !== 'undefined'
      && 'Notification' in window
      && 'serviceWorker' in navigator
      && 'PushManager' in window;
  }

  async reconcileAcceptedSubscription(): Promise<NotificationPreferences> {
    const preferences = this.preferences;
    if (preferences.decision !== 'accepted') {
      return preferences;
    }

    let subscription: PushSubscription | null = null;
    if (this.isSupported && Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.getRegistration(PUSH_WORKER_SCOPE);
      subscription = await registration?.pushManager.getSubscription() ?? null;
    }

    if (
      subscription !== null
      && (subscription.expirationTime === null || subscription.expirationTime > Date.now())
    ) {
      const subscriptionId = await hashPushEndpoint(subscription.endpoint);
      if (preferences.subscriptionId !== subscriptionId) {
        const synchronized = {
          ...preferences,
          subscriptionId,
          updatedAt: new Date().toISOString(),
        };
        this.setPreferences(synchronized);
        return synchronized;
      }
      return preferences;
    }

    if (preferences.subscriptionId) {
      const model = await this.getPushSubscriptionModel();
      const { errors } = await model.delete({ id: preferences.subscriptionId });
      throwIfPushErrors(errors, 'supprimer l’abonnement Push devenu inactif');
    }

    const resetPreferences: NotificationPreferences = {
      decision: 'later',
      topics: preferences.topics,
      updatedAt: new Date().toISOString(),
    };
    this.setPreferences(resetPreferences);
    return resetPreferences;
  }

  async subscribe(topics: NotificationTopic[]): Promise<void> {
    if (topics.length === 0) {
      await this.unsubscribe();
      return;
    }
    if (!this.isSupported) {
      throw new Error('Ce navigateur ne prend pas en charge les notifications Push.');
    }

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error(
        permission === 'denied'
          ? 'Les notifications sont bloquées dans les paramètres de ce navigateur.'
          : 'L’autorisation de notification n’a pas été accordée.',
      );
    }

    const registration = await this.getRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_CONFIG.publicKey),
      });
    }

    const firstSubscribedAt = this.preferences.firstSubscribedAt ?? new Date().toISOString();
    const record = await mapPushSubscription(subscription, topics, firstSubscribedAt);
    await this.persist(record, !!this.preferences.subscriptionId);
    this.setPreferences({
      decision: 'accepted',
      topics,
      subscriptionId: record.id,
      firstSubscribedAt,
      updatedAt: record.lastSeenAt,
    });
  }

  async unsubscribe(): Promise<void> {
    if (this.isSupported) {
      const registration = await navigator.serviceWorker.getRegistration(PUSH_WORKER_SCOPE);
      const subscription = await registration?.pushManager.getSubscription();
      const subscriptionId = subscription
        ? await hashPushEndpoint(subscription.endpoint)
        : this.preferences.subscriptionId;

      if (subscription && !await subscription.unsubscribe()) {
        throw new Error('Le navigateur n’a pas pu supprimer l’abonnement Push.');
      }
      if (subscriptionId) {
        const model = await this.getPushSubscriptionModel();
        const { errors } = await model.delete({ id: subscriptionId });
        throwIfPushErrors(errors, 'supprimer l’abonnement');
      }
    }

    this.setPreferences({
      decision: 'declined',
      topics: [],
      updatedAt: new Date().toISOString(),
    });
  }

  decideLater(topics: NotificationTopic[]): void {
    this.setPreferences({
      ...this.preferences,
      decision: 'later',
      topics,
      updatedAt: new Date().toISOString(),
    });
  }

  decline(): void {
    this.setPreferences({
      decision: 'declined',
      topics: [],
      updatedAt: new Date().toISOString(),
    });
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    this.preferencesSubject.next(this.emptyPreferences());
  }

  private async getRegistration(): Promise<ServiceWorkerRegistration> {
    let registration = await navigator.serviceWorker.getRegistration(PUSH_WORKER_SCOPE);
    if (!registration) {
      registration = await navigator.serviceWorker.register(PUSH_WORKER_PATH, {
        scope: PUSH_WORKER_SCOPE,
      });
    }
    if (registration.active?.state === 'activated') {
      return registration;
    }

    const worker = registration.installing ?? registration.waiting;
    if (!worker) {
      throw new Error('Le Service Worker des notifications ne peut pas être activé.');
    }

    await new Promise<void>((resolve, reject) => {
      const onStateChange = () => {
        if (worker.state === 'activated') {
          worker.removeEventListener('statechange', onStateChange);
          resolve();
        } else if (worker.state === 'redundant') {
          worker.removeEventListener('statechange', onStateChange);
          reject(new Error('L’installation du Service Worker des notifications a échoué.'));
        }
      };
      worker.addEventListener('statechange', onStateChange);
      onStateChange();
    });
    return registration;
  }

  private async persist(record: PushSubscriptionRecord, knownSubscription: boolean): Promise<void> {
    const model = await this.getPushSubscriptionModel();
    await persistPushSubscription(model, record, knownSubscription);
  }

  private async getPushSubscriptionModel(): Promise<PushSubscriptionModel> {
    const session = await fetchAuthSession();
    if (!session.tokens?.idToken) {
      throw new Error('Votre session a expiré. Reconnectez-vous pour gérer les notifications.');
    }
    const client = generateClient<Schema>({ authMode: 'userPool' });
    const model = client.models.PushSubscription;
    if (!model) {
      throw new Error(
        'Le service de notifications est en cours de déploiement. Attendez sa fin puis rechargez la page.',
      );
    }
    return model;
  }

  private setPreferences(preferences: NotificationPreferences): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    this.preferencesSubject.next(preferences);
  }

  private readPreferences(): NotificationPreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return this.emptyPreferences();
      }
      const stored = JSON.parse(raw) as Partial<NotificationPreferences>;
      const topics = Array.isArray(stored.topics)
        ? stored.topics.filter((topic): topic is NotificationTopic =>
          topic === 'news' || topic === 'partner' || topic === 'alerts')
        : [];
      return {
        decision: stored.decision === 'accepted'
          || stored.decision === 'later'
          || stored.decision === 'declined'
          ? stored.decision
          : 'later',
        topics,
        subscriptionId: stored.subscriptionId,
        firstSubscribedAt: stored.firstSubscribedAt,
        updatedAt: stored.updatedAt ?? new Date(0).toISOString(),
      };
    } catch (error) {
      console.warn('[WebPush] Invalid local preferences ignored', error);
      return this.emptyPreferences();
    }
  }

  private emptyPreferences(): NotificationPreferences {
    return {
      decision: 'later',
      topics: [],
      updatedAt: new Date(0).toISOString(),
    };
  }
}
