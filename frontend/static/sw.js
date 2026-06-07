const CACHE = 'alitos-v1';
const STATIC = [
  '/static/css/main.css',
  '/static/js/main.js',
  '/static/img/logo1.png',
];

// ── Install: cachear assets estáticos ────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar caches viejos ──────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first para páginas, cache-first para static ───────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/static/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
  // Para páginas HTML y API: siempre red
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const title = data.title || 'ALITOS';
  const options = {
    body:    data.body    || '',
    icon:    data.icon    || '/static/img/logo1.png',
    badge:   '/static/img/logo1.png',
    tag:     data.tag     || 'alitos-notif',
    data:    { url: data.url || '/' },
    vibrate: [200, 100, 200],
    actions: data.actions || [],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Click en notificación → abrir la URL correspondiente ─────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      clients.openWindow(url);
    })
  );
});
