let trackingActive = false;

// Install and activate
self.addEventListener('install', event => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activated');
  event.waitUntil(self.clients.claim());
});

// Handle Push Notifications from backend
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.error('Push event error:', e);
  }

  const options = {
    body: data.body || 'New update from SpotSurfer',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'push-notification',
    requireInteraction: true,
    data: {
      url: '/',
      ...data
    },
    actions: [
      { action: 'stop', title: 'Stop Tracking', icon: '/icons/icon-192.png' },
      { action: 'view', title: 'Open App', icon: '/icons/icon-192.png' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '📍 SpotSurfer Update', options)
  );
});

// Show Notification (from postMessage)
const showNotification = (title, body) => {
  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    requireInteraction: true,
    tag: 'manual-notification',
    data: { type: 'manual' }
  };

  self.registration.showNotification(title, options);
};

// Listen to messages from client
self.addEventListener('message', event => {
  const data = event.data;

  if (data?.type === 'notification') {
    showNotification(data.title, data.body);
  }

  if (data?.type === 'start-tracking') {
    trackingActive = true;
    console.log('[SW] Trip tracking started');
  }

  if (data?.type === 'stop-tracking') {
    trackingActive = false;
    console.log('[SW] Trip tracking stopped');
  }
});

// Optional: Background Sync (works only in supported browsers)
self.addEventListener('sync', event => {
  if (event.tag === 'tracking-sync' && trackingActive) {
    event.waitUntil(
      showNotification("📍 Trip Update", "Your trip is still being tracked.")
    );
  }
});

// Optional: Periodic Sync (Chrome-only)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'tracking-sync' && trackingActive) {
    event.waitUntil(
      showNotification("📡 Tracking Active", "Your location is still updating in the background.")
    );
  }
});

// Handle clicks on notifications
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'stop') {
    trackingActive = false;

    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'stop-tracking' });
        });
      })
    );
    return;
  }

  // "view" or default click behavior
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const client = clients.find(c => c.url.includes('/') && 'focus' in c);
      return client ? client.focus() : self.clients.openWindow('/');
    })
  );
});
