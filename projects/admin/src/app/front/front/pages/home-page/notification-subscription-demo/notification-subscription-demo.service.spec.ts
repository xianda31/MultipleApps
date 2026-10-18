import { NotificationSubscriptionDemoService } from './notification-subscription-demo.service';

describe('NotificationSubscriptionDemoService', () => {
  const originalNotification = Object.getOwnPropertyDescriptor(window, 'Notification');

  afterEach(() => {
    if (originalNotification) {
      Object.defineProperty(window, 'Notification', originalNotification);
    }
  });

  it('formats selected topics for the native notification', () => {
    const service = new NotificationSubscriptionDemoService();

    expect(service.formatTopicLabels(['news'])).toBe('les actualités');
    expect(service.formatTopicLabels(['news', 'alerts']))
      .toBe('les actualités et les alertes importantes');
    expect(service.formatTopicLabels(['news', 'partner', 'alerts']))
      .toBe('les actualités, les recherches de partenaire et les alertes importantes');
  });

  it('requests permission and displays the demo notification', async () => {
    const notificationConstructor = jasmine.createSpy('Notification')
      .and.returnValue({});
    const requestPermission = jasmine.createSpy('requestPermission').and.resolveTo('granted');
    const showNotification = jasmine.createSpy('showNotification').and.resolveTo();
    const register = spyOn(navigator.serviceWorker, 'register').and.resolveTo({
      active: { state: 'activated' },
      showNotification,
    } as unknown as ServiceWorkerRegistration);

    Object.defineProperty(notificationConstructor, 'permission', {
      configurable: true,
      value: 'default',
    });
    Object.defineProperty(notificationConstructor, 'requestPermission', {
      configurable: true,
      value: requestPermission,
    });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: notificationConstructor,
    });

    const service = new NotificationSubscriptionDemoService();
    await service.requestPermissionAndNotify(['news', 'alerts']);

    expect(requestPermission).toHaveBeenCalledOnceWith();
    expect(register).toHaveBeenCalledWith(
      '/push-demo/notification-demo-sw.js',
      { scope: '/push-demo/' },
    );
    expect(showNotification).toHaveBeenCalledWith(
      'Alerte du club',
      jasmine.objectContaining({
        body: 'Noël tombe en décembre cette année',
        tag: jasmine.stringMatching(/^bcsto-notification-demo-\d+$/),
        requireInteraction: true,
      }),
    );
  });

  it('reports a browser-level refusal', async () => {
    spyOn(window.Notification, 'requestPermission').and.resolveTo('denied');

    const service = new NotificationSubscriptionDemoService();

    await expectAsync(service.requestPermissionAndNotify(['alerts']))
      .toBeRejectedWithError('Les notifications sont bloquées dans les paramètres de ce navigateur.');
  });

  it('falls back to a native notification when the service worker fails', async () => {
    const notificationConstructor = jasmine.createSpy('Notification').and.returnValue({});
    Object.defineProperty(notificationConstructor, 'permission', {
      configurable: true,
      value: 'granted',
    });
    Object.defineProperty(notificationConstructor, 'requestPermission', {
      configurable: true,
      value: jasmine.createSpy('requestPermission'),
    });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: notificationConstructor,
    });
    spyOn(navigator.serviceWorker, 'register').and.rejectWith(new Error('Worker unavailable'));
    spyOn(console, 'warn');

    const service = new NotificationSubscriptionDemoService();
    await service.requestPermissionAndNotify(['alerts']);

    expect(notificationConstructor).toHaveBeenCalledWith(
      'Alerte du club',
      jasmine.objectContaining({ body: 'Noël tombe en décembre cette année' }),
    );
  });
});
