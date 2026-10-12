/* Minimal service worker so Android offers "Install". It is served at /la-posta/sw.js
   (vercel rewrite) so its scope covers /la-posta/menu. Always goes to the network:
   the menu must show current prices, so nothing is cached. */
self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function(){ /* network only */ });
