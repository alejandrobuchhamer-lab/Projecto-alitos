/* ===================== ALITO'S · Service Worker ===================== */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

/* Recibir push del backend */
self.addEventListener("push", e => {
  let data = { title: "Alito's", body: "Nuevo movimiento" };
  try { data = e.data.json(); } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title || "Alito's", {
      body: data.body || "",
      icon: "/assets/alitos-logo.png",
      badge: "/assets/alitos-logo.png",
      data: { url: data.url || "/", kind: data.kind },
      tag: "alitos-notif-" + (data.kind || "gen"),
      renotify: true,
      vibrate: [200, 100, 200],
    })
  );
});

/* Al tocar la notificación: abrir/enfocar la app y navegar */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url  = e.notification.data?.url || "/";
  const kind = e.notification.data?.kind;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes("ALITOS") || c.url.includes("localhost:5500") || c.url.includes(":8000")) {
          c.focus();
          c.postMessage({ type: "navigate", kind, url });
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
