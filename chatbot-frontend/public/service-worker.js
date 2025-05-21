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

// Show notification
const showNotification = (title, body) => {
  const options = {
    body: body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { type: 'tracking' },
    requireInteraction: true, // Forces the notification to stay until clicked
    tag: 'trip-tracking', // Unique tag for updates
    silent: false, // Makes sure the notification is not silent
    vibrate: [200, 100, 200, 100, 200], // More noticeable vibration pattern
    actions: [
      { action: 'stop', title: 'Stop Tracking', icon: '/icons/icon-192.png' },
      { action: 'view', title: 'View Location', icon: '/icons/icon-192.png' }
    ],
    priority: 'high', // Makes it more likely to show when screen is locked
    renotify: true, // Allows showing the same notification multiple times
    autoClose: false, // Prevents automatic closing
    dir: 'auto', // Automatic text direction
    lang: 'en-US', // Specify language
    image: '/icons/icon-512.png', // Larger image for better visibility
    timestamp: Date.now() // Shows when the notification was created
  };

  // Add custom data
  options.data = {
    url: '/', // URL to open when clicked
    type: 'tracking',
    timestamp: Date.now()
  };

  self.registration.showNotification(title, options);
};

// Start periodic notifications
const startTrackingNotifications = () => {
  if (!trackingActive) {
    trackingActive = true;
    trackingInterval = setInterval(() => {
      showNotification(
        "📍 Still tracking...",
        "We're keeping an eye on your location. You can stop tracking anytime."
      );
    }, 10000); // 10 seconds
  }
};

// Stop periodic notifications
const stopTrackingNotifications = () => {
  trackingActive = false;
  if (trackingInterval) {
    clearInterval(trackingInterval);
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
