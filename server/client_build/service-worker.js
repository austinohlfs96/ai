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
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: event.data.data
    });
  }
});
