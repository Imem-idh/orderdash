const CACHE_NAME = 'orderdash-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ── INSTALL : mise en cache ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE : nettoyage anciens caches ─────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH : cache first ──────────────────────────────
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── PUSH NOTIFICATIONS (depuis serveur) ──────────────
self.addEventListener('push', event => {
  let data = { title: 'Nouvelle commande !', body: 'Tu as une nouvelle commande.', icon: '/icons/icon-192.png' };
  
  if(event.data) {
    try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      data: { url: data.url || '/' },
      actions: [
        { action: 'view', title: '👀 Voir la commande' },
        { action: 'dismiss', title: 'Ignorer' }
      ]
    })
  );
});

// ── CLIC SUR NOTIFICATION ────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if(event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if(clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});
