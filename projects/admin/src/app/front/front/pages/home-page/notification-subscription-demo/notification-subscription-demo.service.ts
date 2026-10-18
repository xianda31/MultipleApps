import { Injectable } from '@angular/core';

export type NotificationDemoTopic = 'news' | 'partner' | 'alerts';

const TOPIC_LABELS: Record<NotificationDemoTopic, string> = {
  news: 'les actualités',
  partner: 'les recherches de partenaire',
  alerts: 'les alertes importantes',
};

@Injectable({ providedIn: 'root' })
export class NotificationSubscriptionDemoService {
  async requestPermissionAndNotify(topics: NotificationDemoTopic[]): Promise<void> {
    if (!('Notification' in window)) {
      throw new Error('Ce navigateur ne prend pas en charge les notifications.');
    }

    const notificationApi = window.Notification;
    const permission = notificationApi.permission === 'granted'
      ? 'granted'
      : await notificationApi.requestPermission();

    if (permission !== 'granted') {
      throw new Error(
        permission === 'denied'
          ? 'Les notifications sont bloquées dans les paramètres de ce navigateur.'
          : 'L’autorisation de notification n’a pas été accordée.',
      );
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error('Ce navigateur ne permet pas d’afficher la notification de démonstration.');
    }

    const isAlertDemo = topics.includes('alerts');
    const title = isAlertDemo ? 'Alerte du club' : 'Notifications du club activées';
    const options: NotificationOptions = {
      body: isAlertDemo
        ? 'Noël tombe en décembre cette année'
        : `Vous recevrez ${this.formatTopicLabels(topics)}.`,
      icon: '/assets/icons/android-chrome-192x192.png',
      tag: `bcsto-notification-demo-${Date.now()}`,
      requireInteraction: true,
    };

    try {
      await this.withTimeout(
        navigator.serviceWorker
          .register('/push-demo/notification-demo-sw.js', { scope: '/push-demo/' })
          .then(async (registration) => {
            await this.waitForActivation(registration);
            await registration.showNotification(title, options);
          }),
        5000,
      );
    } catch (error) {
      console.warn('[NotificationDemo] Service Worker unavailable, using native notification', error);
      new notificationApi(title, options);
    }
  }

  formatTopicLabels(topics: NotificationDemoTopic[]): string {
    const labels = topics.map((topic) => TOPIC_LABELS[topic]);
    if (labels.length <= 1) {
      return labels[0] ?? 'les notifications sélectionnées';
    }
    if (labels.length === 2) {
      return `${labels[0]} et ${labels[1]}`;
    }
    return `${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}`;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(
        () => reject(new Error('Délai d’activation du Service Worker dépassé.')),
        timeoutMs,
      );
      promise.then(
        (value) => {
          window.clearTimeout(timeoutId);
          resolve(value);
        },
        (error) => {
          window.clearTimeout(timeoutId);
          reject(error);
        },
      );
    });
  }

  private waitForActivation(registration: ServiceWorkerRegistration): Promise<void> {
    if (registration.active?.state === 'activated') {
      return Promise.resolve();
    }

    const worker = registration.installing ?? registration.waiting;
    if (!worker) {
      return Promise.reject(new Error('Le Service Worker ne peut pas être activé.'));
    }

    return new Promise<void>((resolve, reject) => {
      const onStateChange = () => {
        if (worker.state === 'activated') {
          worker.removeEventListener('statechange', onStateChange);
          resolve();
        } else if (worker.state === 'redundant') {
          worker.removeEventListener('statechange', onStateChange);
          reject(new Error('L’installation du Service Worker a échoué.'));
        }
      };
      worker.addEventListener('statechange', onStateChange);
      onStateChange();
    });
  }
}
