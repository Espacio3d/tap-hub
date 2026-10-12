/* Service worker shared by every client page (/<slug>) that has "Notificaciones de ofertas" on.
   Served from the site root so each page can register it with scope "/<slug>".
   - Fetch: network only (pages must always be current).
   - Push: shows offers sent from the panel (api/push.js); the payload brings title, body, icon and url. */
self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function(){ /* network only */ });

self.addEventListener("push", function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch(err){ d = { body: e.data && e.data.text() }; }
  var scope = new URL(self.registration.scope).pathname;
  e.waitUntil(self.registration.showNotification(d.title || "Novedades", {
    body: d.body || "",
    icon: d.icon || undefined,
    badge: d.badge || undefined,
    data: { url: d.url || scope }
  }));
});

self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || new URL(self.registration.scope).pathname;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++){
      if ("focus" in list[i]){ list[i].navigate(url); return list[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
