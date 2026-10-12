/* Service worker of the La Posta menu app. Served at /la-posta/sw.js (vercel rewrite)
   so its scope covers /la-posta/menu.
   - Install: lets Android offer "Instalar".
   - Fetch: network only. The menu must show current prices, so nothing is cached.
   - Push: shows the offers sent from the Espacio3d.gt panel (api/push.js). */
self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function(){ /* network only */ });

self.addEventListener("push", function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch(err){ d = { title: "La Posta", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "La Posta", {
    body: d.body || "",
    icon: d.icon || "/demo-la-posta/app/icon-192.png",
    badge: "/demo-la-posta/app/icon-192.png",
    data: { url: d.url || "/la-posta/menu" }
  }));
});

self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/la-posta/menu";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++){
      if (list[i].url.indexOf("/la-posta/") !== -1 && "focus" in list[i]){ list[i].navigate(url); return list[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
