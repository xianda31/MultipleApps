self.addEventListener('push', event => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const notification = payload.notification || payload;
  const title = notification.title || 'Bridge Club de Saint-Orens';
  const options = {
    body: notification.body || '',
    icon: notification.icon || '/assets/icons/android-chrome-192x192.png',
    badge: notification.badge || '/assets/icons/android-chrome-192x192.png',
    tag: notification.tag,
    data: notification.data || { url: '/front/accueil' },
    requireInteraction: notification.requireInteraction === true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/front/accueil', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existingClient = windowClients.find(client => client.url.startsWith(self.location.origin));
      if (existingClient) {
        return existingClient.navigate(targetUrl).then(client => client?.focus());
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
