let trackingInterval = null;
let trackingActive = false;

self.addEventListener('install', event => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'push-notification',
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Show notification
const showNotification = (title, body) => {
  const options = {
    body: body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { type: 'tracking' },
    requireInteraction: true,
    tag: 'trip-tracking',
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      { action: 'stop', title: 'Stop Tracking', icon: '/icons/icon-192.png' },
      { action: 'view', title: 'View Location', icon: '/icons/icon-192.png' }
    ],
    priority: 'high',
    renotify: true,
    autoClose: false,
    dir: 'auto',
    lang: 'en-US',
    image: '/icons/icon-512.png',
    timestamp: Date.now()
  };

  self.registration.showNotification(title, options);
};

// Handle incoming messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'notification') {
    showNotification(event.data.title, event.data.body);
  } else if (event.data && event.data.type === 'start-tracking') {
    startTrackingNotifications();
  } else if (event.data && event.data.type === 'stop-tracking') {
    stopTrackingNotifications();
  }
});

// Register background sync
self.addEventListener('sync', event => {
  if (event.tag === 'tracking-sync') {
    event.waitUntil(
      showNotification(
        "📍 Trip Update",
        "Your location is being tracked in the background."
      )
    );
  }
});

// Handle periodic background sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'tracking-sync') {
    event.waitUntil(
      showNotification(
        "📍 Still tracking...",
        "We're keeping an eye on your location. You can stop tracking anytime."
      )
    );
  }
});

// Start tracking notifications
const startTrackingNotifications = () => {
  if (!trackingActive) {
    trackingActive = true;
    
    // Request background sync
    if ('SyncManager' in self) {
      self.registration.sync.register('tracking-sync');
      
      // Request periodic sync (Chrome only)
      if ('periodicSync' in self.registration) {
        self.registration.periodicSync.register('tracking-sync', {
          minInterval: 10000 // 10 seconds
        });
      }
    }
  }
};

// Stop tracking notifications
const stopTrackingNotifications = () => {
  trackingActive = false;
  
  // Remove sync registrations
  if ('SyncManager' in self) {
    self.registration.sync.unregister('tracking-sync');
    
    if ('periodicSync' in self.registration) {
      self.registration.periodicSync.unregister('tracking-sync');
    }
  }
};

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'stop') {
    stopTrackingNotifications();
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'stop-tracking' });
        });
      })
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const client = clients.find(c => c.url === '/' && 'focus' in c);
      
      if (client) {
        return client.focus();
      }

      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
