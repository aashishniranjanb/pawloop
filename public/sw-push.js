// Standalone Companion Service Worker for Native Web Push Notifications

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('Push event received with no payload.');
    return;
  }

  try {
    const payload = event.data.json();
    const title = payload.title || 'PawLoop Notification';
    const options = {
      body: payload.body || 'New operational update from PawLoop.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'pawloop-operational-alert',
      vibrate: [200, 100, 200],
      data: {
        actionUrl: payload.actionUrl || '/',
        stationId: payload.stationId || null,
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error handling push event payload:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const actionUrl = data.actionUrl || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and redirect it
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(actionUrl);
          }
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(actionUrl);
      }
    })
  );
});
