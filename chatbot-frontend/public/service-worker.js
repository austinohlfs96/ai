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

// Handle push events from backend
self.addEventListener('push', event => {
  console.log('[SW] 🚀 Push event received');

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
    console.log('[SW] Push payload:', data);
  } catch (e) {
    console.error('[SW] ❌ Error parsing push payload:', e);
  }

  const options = {
    body: data.body || '📡 New update from SpotSurfer',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    requireInteraction: true,
    data: {
      url: data.url || '/',
      ...data
    },
    actions: [
      { action: 'stop', title: 'Stop Tracking', icon: '/icons/icon-192.png' },
      { action: 'view', title: 'Open App', icon: '/icons/icon-192.png' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '📍 SpotSurfer Alert', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click:', event.action);
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

  // Handle default or "view" action
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const client = clients.find(c => 'focus' in c && c.url.includes('/'));
      return client ? client.focus() : self.clients.openWindow('/');
    })
  );
});

// Handle manual notification via postMessage
const showNotification = (title, options = {}) => {
  const defaultOptions = {
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    requireInteraction: true,
    tag: 'manual-notification',
    data: { type: 'manual' }
  };

  return self.registration.showNotification(title, {
    ...defaultOptions,
    ...options
  });
};


// Listen for messages from client
self.addEventListener('message', event => {
  const data = event.data;

  if (data?.type === 'delayed-notification') {
    setTimeout(() => {
      self.registration.showNotification(data.title, data.options);
    }, data.delay);
  }

  if (data?.type === 'show-notification') {
    self.registration.showNotification(data.title, data.options);
  }

  if (data?.type === 'start-tracking') {
    trackingActive = true;
  }

  if (data?.type === 'stop-tracking') {
    trackingActive = false;
  }
});



// Optional: Background Sync (where supported)
self.addEventListener('sync', event => {
  if (event.tag === 'tracking-sync' && trackingActive) {
    event.waitUntil(
      showNotification("📍 Trip Update", { body: "Your trip is still being tracked." })
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


