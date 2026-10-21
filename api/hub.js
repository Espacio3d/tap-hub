/* ============================================================
   Vercel Serverless Function — renders each client's public page
   on the SERVER, so WhatsApp/Facebook/Twitter (which never run
   JavaScript) see real title/description/image tags when the link
   is shared. The page it outputs still becomes fully interactive
   once loaded in a real browser (Supabase JS runs client-side for
   view/click tracking and the contact-capture form).
   ============================================================ */

var SUPABASE_URL = "https://oifgcicvnrodipjfjkso.supabase.co";
/* Script added to client pages with "Acceso directo" (app_enabled) or "Notificaciones de ofertas"
   (push_enabled) on: box to save the page to the home screen, the shared service worker /sw-clientes.js,
   and, only with push_enabled, the offers (push) subscription. */
var PUSH_CLIENT_JS = "(function(){\n  var SLUG = __SLUG__, NAME = __NAME__, ICON = __ICON__, PUSH = __PUSH__;\n  var VAPID = \"BBCVMr_Y4R-XzRca_vn4i8zVYMz7cSe2fgBbVlTdCXwW4ooetiyN_slc83y5rOFgY4gsj_VuqISd-IdlbBFO4-Q\";\n  var SB = __SB__, KEY = __KEY__;\n  if (!(\"serviceWorker\" in navigator)) return;\n  navigator.serviceWorker.register(\"/sw-clientes.js\", { scope: \"/\" + SLUG }).catch(function(){});\n  var ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua);\n  var standalone = matchMedia(\"(display-mode: standalone)\").matches || navigator.standalone;\n  var inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\\//.test(ua) || (ios && !/Safari\\//.test(ua));\n  var st = document.createElement(\"style\");\n  st.textContent = \".e3-box{position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));max-width:520px;margin:0 auto;z-index:50;background:#fff;color:#222;border:1px solid #e6e3db;border-radius:18px;box-shadow:0 14px 34px rgba(0,0,0,.18);padding:12px 12px 12px 14px;display:flex;gap:12px;align-items:center;font-family:system-ui,sans-serif;transform:translateY(170%);transition:transform .35s}.e3-box.on{transform:none}.e3-box img{width:44px;height:44px;border-radius:12px;flex:0 0 auto;object-fit:cover}.e3-box .t{flex:1;font-size:13px;line-height:1.35}.e3-box .t b{display:block;font-size:14px}.e3-box .go{background:#222;color:#fff;border:0;font-weight:700;font-size:13px;padding:10px 12px;border-radius:12px;white-space:nowrap}.e3-box .x{background:none;border:0;font-size:20px;color:#888;padding:4px 6px}\";\n  document.head.appendChild(st);\n  function box(html){\n    var b = document.createElement(\"div\"); b.className = \"e3-box\";\n    b.innerHTML = (ICON ? '<img src=\"' + ICON + '\" alt=\"\">' : '') + html + '<button class=\"x\" type=\"button\" aria-label=\"Cerrar\">\u00d7</button>';\n    document.body.appendChild(b); setTimeout(function(){ b.classList.add(\"on\"); }, 50);\n    b.querySelector(\".x\").onclick = function(){ b.classList.remove(\"on\"); };\n    return b;\n  }\n  function seen(k){ try { return Date.now() < (+localStorage.getItem(\"e3-\" + k + \"-\" + SLUG) || 0); } catch(e){ return false; } }\n  function later(k, days){ try { localStorage.setItem(\"e3-\" + k + \"-\" + SLUG, Date.now() + days * 864e5); } catch(e){} }\n  var force = /[?&]avisos\\b/.test(location.search);\n  function b64(s){ s = s.replace(/-/g, \"+\").replace(/_/g, \"/\"); var raw = atob(s + \"===\".slice((s.length + 3) % 4)); var a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }\n  function save(sub){\n    var j = sub.toJSON();\n    return fetch(SB + \"/rest/v1/push_subscriptions\", { method: \"POST\",\n      headers: { apikey: KEY, Authorization: \"Bearer \" + KEY, \"Content-Type\": \"application/json\", Prefer: \"return=minimal\" },\n      body: JSON.stringify({ client_slug: SLUG, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: ua.slice(0, 200) }) });\n  }\n  /* 1) Offers (push). iPhone only allows it from the saved app. */\n  var canPush = PUSH && (\"PushManager\" in window) && (\"Notification\" in window) && Notification.permission !== \"denied\" && (!ios || standalone);\n  if (canPush) navigator.serviceWorker.ready.then(function(reg){\n    return reg.pushManager.getSubscription().then(function(sub){\n      if (sub){ save(sub); return; }\n      if (!force && seen(\"push\")) return;\n      setTimeout(function(){\n        if (document.querySelector(\".e3-box.on\")) return;\n        var b = box('<div class=\"t\"><b>\ud83d\udd14 \u00bfTe avisamos de las ofertas?</b>Recibe las promociones de ' + NAME + ' en tu celular.</div><button class=\"go\" type=\"button\">S\u00ed, av\u00edsame</button>');\n        b.querySelector(\".x\").addEventListener(\"click\", function(){ later(\"push\", 14); });\n        b.querySelector(\".go\").onclick = function(){\n          Notification.requestPermission().then(function(p){\n            if (p !== \"granted\"){ b.classList.remove(\"on\"); return; }\n            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) }).then(save).then(function(){\n              b.querySelector(\".t\").innerHTML = \"<b>\u2705 \u00a1Listo!</b>Te avisaremos de las ofertas.\";\n              b.querySelector(\".go\").remove(); setTimeout(function(){ b.classList.remove(\"on\"); }, 2500);\n            });\n          }).catch(function(){ b.classList.remove(\"on\"); });\n        };\n      }, force ? 800 : 3500);\n    });\n  });\n  /* 2) Save to the home screen (needed on iPhone before offers can be enabled). */\n  if (standalone || (!force && seen(\"install\"))) return;\n  window.addEventListener(\"appinstalled\", function(){ later(\"install\", 3650); });\n  window.addEventListener(\"beforeinstallprompt\", function(e){\n    e.preventDefault(); var deferred = e;\n    setTimeout(function(){\n      if (document.querySelector(\".e3-box.on\")) return;\n      var b = box('<div class=\"t\"><b>Guarda ' + NAME + ' en tu celular</b>\u00c1brelo como una app, con un toque.</div><button class=\"go\" type=\"button\">Instalar</button>');\n      later(\"install\", 30);   // shown once; Safari cannot tell if it is already saved\n      b.querySelector(\".x\").addEventListener(\"click\", function(){ later(\"install\", 30); });\n      b.querySelector(\".go\").onclick = function(){ deferred.prompt(); deferred.userChoice.then(function(){ b.classList.remove(\"on\"); later(\"install\", 365); }); };\n    }, 2500);\n  });\n  if (ios) setTimeout(function(){\n    if (document.querySelector(\".e3-box.on\")) return;\n    var b = box('<div class=\"t\"><b>Guarda ' + NAME + ' en tu celular</b>' + (inApp\n      ? '\u00c1brelo en Safari y luego toca \u00b7\u00b7\u00b7 \u2192 Compartir \u2b06\ufe0f \u2192 \"Agregar a pantalla de inicio\".'\n      : 'Toca \u00b7\u00b7\u00b7 abajo, luego Compartir \u2b06\ufe0f y elige \"Agregar a pantalla de inicio\".') + '</div>');\n    later(\"install\", 30);   // shown once; Safari cannot tell if it is already saved\n    b.querySelector(\".x\").addEventListener(\"click\", function(){ later(\"install\", 30); });\n  }, 2500);\n})();\n";

var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZmdjaWN2bnJvZGlwamZqa3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTQ3OTksImV4cCI6MjEwNTg3MDc5OX0.rkGZ2UQhgqcFns4KpHocYXFbh5o5cgFhOV68OIwyNBQ";

var ICONS = {
  menu:      '<path d="M4 5h16M4 12h16M4 19h10" stroke-width="2" stroke-linecap="round"/>',
  review:    '<path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1L6.6 19.3l1.3-6-4.6-4.1 6.1-.6z" stroke-width="1.6" stroke-linejoin="round" fill="none"/>',
  wifi:      '<path d="M3 8.5a17 17 0 0 1 18 0M6.2 12.3a12 12 0 0 1 11.6 0M9.6 16a7 7 0 0 1 4.8 0" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="12" cy="19.3" r="1.3" fill="currentColor" stroke="none"/>',
  rewards:   '<path d="M12 21s-7-4.4-9.5-8.8C.7 8.6 2.3 5 6 5c2 0 3.3 1 4 2.2 0-.1 0-.1 0 0C10.7 6 12 5 14 5c3.7 0 5.3 3.6 3.5 7.2C19 16.6 12 21 12 21z" stroke-width="1.6" stroke-linejoin="round" fill="none"/>',
  app:       '<rect x="7" y="2.5" width="10" height="19" rx="2" stroke-width="1.6" fill="none"/><path d="M11 18.5h2" stroke-width="1.6" stroke-linecap="round"/>',
  cuponera:  '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4z" stroke-width="1.6" stroke-linejoin="round" fill="none"/><path d="M15.5 7v10" stroke-width="1.4" stroke-dasharray="1.6 2" fill="none"/><path d="M9 9.4l.8 1.6 1.8.3-1.3 1.2.3 1.8L9 13.4l-1.6.9.3-1.8-1.3-1.2 1.8-.3z" stroke-width="1.3" stroke-linejoin="round" fill="none"/>',
  giftcard:  '<rect x="3" y="7" width="18" height="13" rx="2" stroke-width="1.6" fill="none"/><path d="M3 12h18M12 7v13M8.5 7c-1.4 0-2.5-1-2.5-2.2C6 3.6 7 3 8 3.4c1.3.5 2.5 2 3 3.6-1 0-2.5 0-2.5 0zm7 0c1.4 0 2.5-1 2.5-2.2C18 3.6 17 3 16 3.4c-1.3.5-2.5 2-3 3.6 1 0 2.5 0 2.5 0z" stroke-width="1.4" stroke-linejoin="round" fill="none"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="4" stroke-width="1.6" fill="none"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/>',
  facebook:  '<path d="M14 21v-7h2.5l.5-3H14V9c0-.9.3-1.5 1.7-1.5H17V4.8C16.6 4.7 15.6 4.6 14.5 4.6c-2.4 0-4 1.4-4 4.1V11H8v3h2.5v7z" stroke-width="1.2" stroke-linejoin="round" fill="none"/>',
  linkedin:  '<rect x="3" y="3" width="18" height="18" rx="4" stroke-width="1.6" fill="none"/><circle cx="8" cy="8.2" r="1.3" fill="currentColor" stroke="none"/><path d="M8 11v6" stroke-width="1.8" stroke-linecap="round"/><path d="M12 17v-6M12 12.4c0-1 .9-1.8 2-1.8 1.2 0 2.1.9 2.1 2.3V17" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  recetario: '<path d="M12 6.5C10.5 5.3 8.2 4.8 4 5v13c4.2-.2 6.5.3 8 1.5 1.5-1.2 3.8-1.7 8-1.5V5c-4.2-.2-6.5.3-8 1.5z" stroke-width="1.6" stroke-linejoin="round" fill="none"/><path d="M12 6.5v13M7 9h2.5M7 12h2.5M14.5 9H17M14.5 12H17" stroke-width="1.5" stroke-linecap="round"/>',
  website:   '<circle cx="12" cy="12" r="9" stroke-width="1.6" fill="none"/><path d="M3 12h18M12 3c2.5 2.5 3.8 6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-6-3.8-9s1.3-6.5 3.8-9z" stroke-width="1.4" fill="none"/>',
  calendar:  '<rect x="3.5" y="5" width="17" height="16" rx="2" stroke-width="1.6" fill="none"/><path d="M8 3v4M16 3v4M3.5 10h17" stroke-width="1.6" stroke-linecap="round"/>',
  phone:     '<path d="M6.5 3.5h3l1.3 4.5-2.2 1.7a13 13 0 0 0 5.7 5.7l1.7-2.2 4.5 1.3v3c0 1.2-1 2-2.1 1.9C10.8 19 5 13.2 4.6 5.6 4.5 4.5 5.3 3.5 6.5 3.5z" stroke-width="1.5" stroke-linejoin="round" fill="none"/>',
  game:      '<rect x="2.5" y="8" width="19" height="9" rx="4" stroke-width="1.6" fill="none"/><path d="M7 10.5v4M5 12.5h4" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="18.2" cy="13.2" r="1" fill="currentColor" stroke="none"/>',
  offer:     '<path d="M20 12.2 12.6 20l-9-9L4 4l7 .4z" stroke-width="1.6" stroke-linejoin="round" fill="none"/><circle cx="8.3" cy="8.3" r="1.4" stroke-width="1.4" fill="none"/>',
  whatsapp:  '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3z" stroke-width="1.5" fill="none"/><path d="M8.3 8.7c-.2.9.1 2 1.3 3.5s2.5 2.2 3.6 2.3c1 .1 1.6-.5 1.8-1l-1.7-1.1c-.3.3-.7.6-1.1.4-.6-.3-1.6-1.1-2.1-2.1-.2-.4.1-.7.4-1l-.9-1.6c-.5-.1-1.1.1-1.3.6z" fill="currentColor" stroke="none"/>',
  survey:    '<rect x="4" y="3" width="16" height="18" rx="2" stroke-width="1.6" fill="none"/><path d="M8 8h8M8 12l1.6 1.6L12.5 10M8 16h5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  support:   '<circle cx="12" cy="12" r="8.5" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="3.2" stroke-width="1.5" fill="none"/><path d="M6.2 6.2l3.3 3.3M17.8 6.2l-3.3 3.3M6.2 17.8l3.3-3.3M17.8 17.8l-3.3-3.3" stroke-width="1.4" stroke-linecap="round"/>',
  contact:   '<rect x="3" y="5" width="18" height="14" rx="2" stroke-width="1.6" fill="none"/><circle cx="9" cy="11" r="2" stroke-width="1.5" fill="none"/><path d="M6 16c0-1.7 1.3-3 3-3s3 1.3 3 3M14 9h4M14 13h4" stroke-width="1.5" stroke-linecap="round"/>'
};

var FONTS = {
  default:    { css:null },
  poppins:    { css:"'Poppins',sans-serif" },
  playfair:   { css:"'Playfair Display',serif" },
  montserrat: { css:"'Montserrat',sans-serif" },
  bebas:      { css:"'Bebas Neue',sans-serif" },
  fraunces:   { css:"'Fraunces',serif" },
  quicksand:  { css:"'Quicksand',sans-serif" },
  oswald:     { css:"'Oswald',sans-serif" },
  abril:      { css:"'Abril Fatface',serif" },
  dmserif:    { css:"'DM Serif Display',serif" },
  righteous:  { css:"'Righteous',sans-serif" },
  pacifico:   { css:"'Pacifico',cursive" },
  caveat:     { css:"'Caveat',cursive" }
};

function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function isImageUrl(s){ return /^https?:\/\//i.test(s || ''); }
function contrastTextColor(hex){
  var h = (hex||'').replace('#','');
  if(h.length === 3){ h = h.split('').map(function(c){ return c+c; }).join(''); }
  var r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
  if(isNaN(r) || isNaN(g) || isNaN(b)) return '';
  var brightness = (r*299 + g*587 + b*114) / 1000;
  return brightness >= 150 ? '#181C1B' : '#FFFFFF';
}
function svgIcon(key, cls){
  return '<svg class="'+(cls||'icon')+'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">'+(ICONS[key]||ICONS.website)+'</svg>';
}
function logoInner(logo){
  if (isImageUrl(logo)) return '<img src="'+escapeHtml(logo)+'" alt="" style="width:100%;height:100%;object-fit:contain;">';
  return escapeHtml(logo || '•');
}
function slugify(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48) || 'cliente';
}

var CSS = '\
:root{--bg:#F6F5F2;--surface:#FFFFFF;--surface-edge:#E6E3DB;--text:#181C1B;--text-dim:#666F6C;--accent-default:#0E7A5F;--accent-ink:#FFFFFF;--chip-bg:#EFEDE6;color-scheme:light;}\
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#121615;--surface:#1C2120;--surface-edge:#2B3230;--text:#EEF1EF;--text-dim:#9AA5A1;--accent-default:#2FD1A4;--accent-ink:#0B1413;--chip-bg:#242B29;color-scheme:dark;}}\
:root[data-theme="dark"]{--bg:#121615;--surface:#1C2120;--surface-edge:#2B3230;--text:#EEF1EF;--text-dim:#9AA5A1;--accent-default:#2FD1A4;--accent-ink:#0B1413;--chip-bg:#242B29;color-scheme:dark;}\
*{box-sizing:border-box;}html,body{height:100%;}\
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:var(--bg-img,none);background-size:cover;background-position:center;background-repeat:no-repeat;}\
body{margin:0;background:var(--bg);color:var(--text);font-family:"Work Sans",-apple-system,BlinkMacSystemFont,sans-serif;padding-inline:16px;padding-block:28px;}\
img{max-width:100%;}\
#app{max-width:480px;margin:0 auto;}\
.icon{width:18px;height:18px;flex:0 0 auto;}.icon path,.icon circle,.icon rect{stroke:currentColor;}\
.hub{display:flex;flex-direction:column;gap:20px;align-items:center;padding-top:8px;font-family:var(--hub-font, inherit);}\
.hub-avatar{width:76px;height:76px;border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:700;color:var(--accent-ink);background:var(--accent, var(--accent-default));overflow:hidden;}\
.hub h1{font-size:24px;text-align:center;font-family:var(--hub-font, "Outfit"), -apple-system, sans-serif;margin:0;text-wrap:balance;color:var(--hub-text, var(--text));}\
.hub .tagline{color:var(--hub-text, var(--text-dim));font-size:14px;text-align:center;margin-top:-8px;}\
.hub-links{width:100%;display:flex;flex-direction:column;gap:10px;}\
.hub-link{display:flex;align-items:center;gap:12px;background:var(--hub-card, var(--surface));border:1px solid var(--surface-edge);border-radius:14px;padding:15px 16px;text-decoration:none;color:var(--hub-card-text, var(--text));font-weight:500;font-size:15px;}\
.hub-link .icon-badge{width:34px;height:34px;border-radius:10px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;background:var(--chip-bg);color:var(--accent, var(--accent-default));}\
.hub-link .chev{margin-left:auto;color:var(--hub-card-text, var(--text-dim));width:16px;height:16px;}\
.hub-footer{color:var(--text-dim);font-size:12px;text-align:center;padding-top:8px;}.hub-footer a{color:inherit;}\
.capture-box{width:100%;background:var(--surface);border:1px solid var(--surface-edge);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--text-dim);}\
.capture-row{display:flex;gap:8px;}\
.capture-row input{flex:1;min-width:0;background:var(--bg);border:1px solid var(--surface-edge);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);}\
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:12px;padding:12px 18px;font-size:15px;font-weight:600;cursor:pointer;font-family:"Outfit",sans-serif;}\
.btn-primary{background:var(--accent, var(--accent-default));color:var(--accent-ink);}\
.not-found{text-align:center;padding-block:60px;color:var(--text-dim);}\
.dir-search{width:100%;background:var(--hub-card, var(--surface));border:1px solid var(--surface-edge);border-radius:14px;padding:13px 16px;font-size:15px;color:var(--hub-card-text, var(--text));font-family:inherit;}\
.dir-chips{width:100%;display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;}\
.dir-chips::-webkit-scrollbar{display:none;}\
.dir-chip{flex:0 0 auto;border:1px solid var(--surface-edge);background:var(--hub-card, var(--surface));color:var(--hub-card-text, var(--text));border-radius:99px;padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;}\
.dir-chip.on{background:var(--accent, var(--accent-default));color:var(--accent-ink);border-color:transparent;}\
.dir-row small{display:block;font-size:12px;font-weight:400;opacity:.7;}\
.dir-empty{width:100%;text-align:center;color:var(--hub-text, var(--text-dim));font-size:14px;padding:12px 0;}\
.rv-box{width:100%;background:var(--hub-card, var(--surface));border:1px solid var(--surface-edge);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center;color:var(--hub-card-text, var(--text));}\
.rv-title{font-weight:600;font-size:15px;}\
.rv-sub{font-size:13px;opacity:.75;}\
.rv-stars{display:flex;gap:4px;}\
.rv-star{background:none;border:0;padding:2px 3px;font-size:34px;line-height:1;cursor:pointer;color:#c4c4c4;font-family:inherit;}\
.rv-star.on{color:#f5b301;}\
.rv-more{width:100%;display:flex;flex-direction:column;gap:8px;}\
.rv-more textarea,.rv-more input{width:100%;background:var(--bg);border:1px solid var(--surface-edge);border-radius:10px;padding:10px 12px;font-size:16px;color:var(--text);font-family:inherit;}\
.rv-more textarea{min-height:84px;resize:vertical;}\
.rv-msg{font-size:12px;color:#d33;}\
.rv-act{display:flex;flex-direction:column;gap:8px;width:100%;}\
.rv-link{display:block;text-align:center;text-decoration:none;border-radius:12px;padding:12px 14px;font-weight:600;font-size:14px;border:1px solid var(--surface-edge);color:var(--hub-card-text, var(--text));}\
.rv-link.main{background:var(--accent, var(--accent-default));color:var(--accent-ink);border-color:transparent;}\
';


/* Calificación con estrellas (se inyecta dentro del script de la página; usa su cliente de Supabase). */
function reviewsInit(sb, slug, cfg, logEvent){
  var box = document.getElementById('rvBox');
  if(!box) return;
  var stars = [].slice.call(box.querySelectorAll('.rv-star'));
  var more = document.getElementById('rvMore'), send = document.getElementById('rvSend'), msg = document.getElementById('rvMsg');
  var rating = 0;
  stars.forEach(function(s, i){
    s.addEventListener('click', function(){
      rating = i + 1;
      stars.forEach(function(x, j){ x.classList.toggle('on', j < rating); });
      more.style.display = '';
    });
  });
  function add(parent, tag, cls, text){
    var el = document.createElement(tag);
    if(cls) el.className = cls;
    if(text) el.textContent = text;
    parent.appendChild(el);
    return el;
  }
  function link(parent, href, text, main, label){
    var a = add(parent, 'a', 'rv-link' + (main ? ' main' : ''), text);
    a.href = href; a.target = '_blank'; a.rel = 'noopener';
    a.addEventListener('click', function(){ logEvent('click', label); });
  }
  function done(comment, name){
    var low = rating <= 3;
    box.textContent = '';
    add(box, 'div', 'rv-title', '¡Gracias por tu opinión!');
    add(box, 'div', 'rv-sub', low ? 'Lamentamos que no haya sido perfecto. Si quieres, cuéntaselo directo al negocio.' : 'Nos alegra que te haya gustado.');
    var act = add(box, 'div', 'rv-act');
    var wa = '';
    if(cfg.wa){
      var text = 'Hola, ' + (name ? 'soy ' + name + '. ' : '') + 'califiqué ' + cfg.name + ' con ' + rating + ' de 5 estrellas' + (comment ? ': ' + comment : '.');
      wa = 'https://wa.me/' + cfg.wa + '?text=' + encodeURIComponent(text);
    }
    // Las dos opciones salen siempre, sin importar las estrellas; solo cambia cuál va primero.
    if(low){
      if(wa) link(act, wa, '💬 Escribirle al negocio por WhatsApp', true, 'Comentario por WhatsApp');
      if(cfg.google) link(act, cfg.google, '⭐ Publicar mi reseña en Google', !wa, 'Reseña en Google');
    }else{
      if(cfg.google) link(act, cfg.google, '⭐ Publicar mi reseña en Google', true, 'Reseña en Google');
      if(wa) link(act, wa, '💬 Escribirle al negocio por WhatsApp', !cfg.google, 'Comentario por WhatsApp');
    }
  }
  send.addEventListener('click', function(){
    if(!rating || send.disabled) return;
    var comment = document.getElementById('rvComment').value.trim().slice(0, 500);
    var name = document.getElementById('rvName').value.trim().slice(0, 60);
    send.disabled = true; send.textContent = 'Enviando...'; msg.textContent = '';
    sb.rpc('submit_review', { p_slug: slug, p_rating: rating, p_comment: comment, p_name: name }).then(function(r){
      if(r.error){ send.disabled = false; send.textContent = 'Enviar'; msg.textContent = 'No se pudo enviar. Intenta de nuevo en un momento.'; return; }
      done(comment, name);
    });
  });
}

/* Búsqueda y categorías del directorio (se inyecta como script propio, no depende de Supabase). */
function dirFilter(){
  var rows = [].slice.call(document.querySelectorAll('#dirList .dir-row'));
  if(!rows.length) return;
  var q = document.getElementById('dirSearch'), chips = document.getElementById('dirChips'), empty = document.getElementById('dirEmpty');
  var cat = '';
  function norm(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function apply(){
    var term = q ? norm(q.value.trim()) : '';
    var shown = 0;
    rows.forEach(function(r){
      var ok = (!cat || r.getAttribute('data-cat') === cat) && (!term || r.getAttribute('data-search').indexOf(term) !== -1);
      r.style.display = ok ? '' : 'none';
      if(ok) shown++;
    });
    if(empty) empty.style.display = shown ? 'none' : '';
  }
  if(q) q.addEventListener('input', apply);
  if(chips) chips.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('.dir-chip') : null;
    if(!b) return;
    cat = b.getAttribute('data-cat') || '';
    [].forEach.call(chips.querySelectorAll('.dir-chip'), function(c){ c.classList.toggle('on', c === b); });
    apply();
  });
}

var FONT_LINK = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Work+Sans:wght@400;500;600&family=Poppins:wght@500;600;700&family=Playfair+Display:wght@600;700&family=Montserrat:wght@500;600;700&family=Bebas+Neue&family=Fraunces:wght@600;700&family=Quicksand:wght@500;600;700&family=Oswald:wght@500;600;700&family=Abril+Fatface&family=DM+Serif+Display&family=Righteous&family=Pacifico&family=Caveat:wght@600;700&display=swap">';


function renderPage(client, pageUrl){
  var fontDef = FONTS[client.font];
  var hubFontVar = (fontDef && fontDef.css) ? ('--hub-font:'+fontDef.css+';') : '';
  var hubTextVar = client.text_color ? ('--hub-text:'+client.text_color+';') : '';
  var hubCardVar = client.card_color ? ('--hub-card:'+client.card_color+';--hub-card-text:'+contrastTextColor(client.card_color)+';') : '';
  var accentVar = '--accent:'+(client.accent || '#0E7A5F')+';';
  var bgStyle = isImageUrl(client.background)
    ? '--bg-img:url(\''+cssUrl(client.background)+'\');'
    : (client.background ? '--bg:'+client.background+';' : '');

  function cssUrl(u){ return String(u).replace(/['"()\\\s]/g, function(c){ return '%'+('0'+c.charCodeAt(0).toString(16)).slice(-2).toUpperCase(); }); }
  var deviceBgCss = '';
  if(isImageUrl(client.background_tablet)){
    deviceBgCss += '@media (min-width:700px){body{--bg-img:url(\''+cssUrl(client.background_tablet)+'\') !important;}}';
  }
  if(isImageUrl(client.background_desktop)){
    deviceBgCss += '@media (min-width:1100px){body{--bg-img:url(\''+cssUrl(client.background_desktop)+'\') !important;}}';
  }

  var linksHtml = (client.buttons || []).map(function(b){
    var badgeStyle = b.color ?
      'background:'+escapeHtml(b.color)+';color:#fff;' :
      'background:var(--chip-bg);color:var(--accent, var(--accent-default));';
    var badgeInner = b.iconImage ?
      '<img src="'+escapeHtml(b.iconImage)+'" alt="" style="width:20px;height:20px;object-fit:contain;border-radius:4px;">' :
      svgIcon(b.icon);
    return '<a class="hub-link" href="'+escapeHtml(b.url)+'" target="_blank" rel="noopener">'+
      '<span class="icon-badge" style="'+badgeStyle+'">'+badgeInner+'</span>'+
      '<span>'+escapeHtml(b.label)+'</span>'+
      '<svg class="chev" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
    '</a>';
  }).join('');

  var contactHtml = (client.phone && client.save_contact_enabled) ?
    '<a class="hub-link" data-tap-extra="1" href="'+pageUrl+'/vcard">'+
      '<span class="icon-badge" style="background:var(--accent, var(--accent-default));color:#fff;">'+svgIcon('contact')+'</span>'+
      '<span>Guardar Contacto</span>'+
      '<svg class="chev" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
    '</a>' : '';

  var whatsappHtml = (client.phone && client.whatsapp_enabled) ?
    '<a class="hub-link" data-tap-extra="1" href="https://wa.me/'+client.phone.replace(/[^0-9]/g,'')+'" target="_blank" rel="noopener">'+
      '<span class="icon-badge" style="background:#25D366;color:#fff;">'+svgIcon('whatsapp')+'</span>'+
      '<span>Escribir por WhatsApp</span>'+
      '<svg class="chev" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
    '</a>' : '';

  var isPhoneCapture = client.capture_type === 'phone';
  var captureHtml = client.capture_leads ?
    '<div class="capture-box" id="captureBox">'+
      '<span>'+(isPhoneCapture ? 'Déjanos tu teléfono' : 'Déjanos tu correo')+'</span>'+
      '<div class="capture-row">'+
        '<input type="'+(isPhoneCapture ? 'tel' : 'email')+'" id="leadInput" placeholder="'+(isPhoneCapture ? '+502 1234 5678' : 'tu@correo.com')+'">'+
        '<button class="btn btn-primary btn-sm" id="leadSendBtn" type="button">Enviar</button>'+
      '</div>'+
    '</div>' : '';

  var pushOn = client.push_enabled === true && client.active !== false;
  var appOn = pushOn || (client.app_enabled === true && client.active !== false);
  var appIcon = client.push_icon_192 || (isImageUrl(client.logo) ? client.logo : '');
  var pushHead = appOn ?
    '<link rel="manifest" href="/api/manifest?slug='+encodeURIComponent(client.slug)+'">\n'+
    (appIcon ? '<link rel="apple-touch-icon" href="'+escapeHtml(appIcon)+'">\n' : '')+
    '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'+
    '<meta name="apple-mobile-web-app-title" content="'+escapeHtml(String(client.name).slice(0, 12))+'">\n' : '';
  var pushScript = appOn ? '<script>\n'+PUSH_CLIENT_JS
      .replace('__PUSH__', String(pushOn)).replace('__SLUG__', JSON.stringify(client.slug)).replace('__NAME__', JSON.stringify(escapeHtml(client.name)))
      .replace('__ICON__', JSON.stringify(appIcon)).replace('__SB__', JSON.stringify(SUPABASE_URL)).replace('__KEY__', JSON.stringify(SUPABASE_ANON_KEY))
      .replace(/<\/script/gi, '<\\/script')+'\n<\/script>\n' : '';
  // Bottom tabs of the saved app, and the "switched off while open" check (every client).
  pushScript += '<script src="/app-tabs.js" data-slug="'+escapeHtml(client.slug)+'"'+
    (appOn ? ' data-tabs="'+escapeHtml(client.app_tabs || 'home')+'" data-accent="'+escapeHtml(client.accent || '')+'"' : ' data-tabs=""')+'><\/script>\n';

  var isDirectory = client.page_type === 'directory';
  var dirEntries = (isDirectory && Array.isArray(client.directory)) ? client.directory.filter(function(e){ return e && e.name && /^https?:\/\//i.test(e.url || ''); }) : [];
  var dirCats = [];
  dirEntries.forEach(function(e){ var c = String(e.category || '').trim(); if(c && dirCats.indexOf(c) === -1) dirCats.push(c); });
  function dirNorm(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  var directoryHtml = '';
  if(isDirectory){
    directoryHtml =
      (dirEntries.length >= 5 ? '<input type="search" class="dir-search" id="dirSearch" placeholder="Buscar restaurante" autocomplete="off">' : '')+
      (dirCats.length > 1 ? '<div class="dir-chips" id="dirChips"><button type="button" class="dir-chip on" data-cat="">Todos</button>'+
        dirCats.map(function(c){ return '<button type="button" class="dir-chip" data-cat="'+escapeHtml(c)+'">'+escapeHtml(c)+'</button>'; }).join('')+'</div>' : '')+
      '<div class="hub-links" id="dirList">'+dirEntries.map(function(e){
        var cat = String(e.category || '').trim();
        var badge = isImageUrl(e.logo)
          ? '<img src="'+escapeHtml(e.logo)+'" alt="" style="width:100%;height:100%;object-fit:contain;">'
          : escapeHtml(String(e.name).trim().charAt(0).toUpperCase());
        return '<a class="hub-link dir-row" href="'+escapeHtml(e.url)+'" target="_blank" rel="noopener" data-label="'+escapeHtml(e.name)+'" data-cat="'+escapeHtml(cat)+'" data-search="'+escapeHtml(dirNorm(e.name+' '+cat))+'">'+
          '<span class="icon-badge" style="font-weight:700;overflow:hidden;">'+badge+'</span>'+
          '<span style="min-width:0;">'+escapeHtml(e.name)+(cat ? '<small>'+escapeHtml(cat)+'</small>' : '')+'</span>'+
          '<svg class="chev" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
        '</a>';
      }).join('')+'</div>'+
      '<div class="dir-empty" id="dirEmpty" style="display:none;">No encontramos ese restaurante.</div>';
  }

  /* Calificación con estrellas (encendida por cliente desde el panel). */
  function rvScript(t){ return JSON.stringify(t).replace(/</g, '\\u003c'); }
  var rvOn = client.reviews_enabled === true && client.active !== false;
  var rvGoogle = String(client.reviews_google_url || '').trim();
  if(!rvGoogle && Array.isArray(client.buttons)){
    client.buttons.forEach(function(b){ if(!rvGoogle && b && b.icon === 'review' && b.url) rvGoogle = String(b.url).trim(); });
  }
  if(!/^https:\/\//i.test(rvGoogle)) rvGoogle = '';
  var rvWa = (client.reviews_whatsapp !== false && client.phone) ? String(client.phone).replace(/[^0-9]/g, '') : '';
  if(rvWa.length < 8) rvWa = '';
  var reviewsHtml = rvOn ?
    '<div class="rv-box" id="rvBox">'+
      '<div class="rv-title">¿Cómo fue tu experiencia?</div>'+
      '<div class="rv-stars">'+[1,2,3,4,5].map(function(n){ return '<button type="button" class="rv-star" aria-label="'+n+(n === 1 ? ' estrella' : ' estrellas')+'">★</button>'; }).join('')+'</div>'+
      '<div class="rv-more" id="rvMore" style="display:none;">'+
        '<textarea id="rvComment" maxlength="500" placeholder="Cuéntanos qué te pareció (opcional)"></textarea>'+
        '<input type="text" id="rvName" maxlength="60" placeholder="Tu nombre (opcional)" autocomplete="given-name">'+
        '<div class="rv-msg" id="rvMsg"></div>'+
        '<button type="button" class="btn btn-primary" id="rvSend">Enviar</button>'+
      '</div>'+
    '</div>' : '';
  var rvInit = rvOn ? '  ('+reviewsInit.toString()+')(sb, slug, '+rvScript({ name: client.name, google: rvGoogle, wa: rvWa })+', logEvent);\n' : '';

  var ogTitle = client.name;
  var inactive = client.active === false;
  var ogDesc = inactive ? 'Esta página no está disponible por el momento.' : (client.tagline || (isDirectory ? 'Directorio de restaurantes' : 'Contacta a '+client.name));
  var ogImage = isImageUrl(client.logo) ? client.logo : '';

  var html = '<!doctype html>\n<html lang="es"><head>\n'+
    '<meta charset="utf-8">\n'+
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'+
    (inactive ? '<meta name="robots" content="noindex">\n' : '')+
    '<title>'+escapeHtml(ogTitle)+'</title>\n'+
    '<meta property="og:type" content="website">\n'+
    '<meta property="og:title" content="'+escapeHtml(ogTitle)+'">\n'+
    '<meta property="og:description" content="'+escapeHtml(ogDesc)+'">\n'+
    '<meta property="og:url" content="'+escapeHtml(pageUrl)+'">\n'+
    (ogImage ? '<meta property="og:image" content="'+escapeHtml(ogImage)+'">\n<meta name="twitter:card" content="summary">\n' : '<meta name="twitter:card" content="summary">\n')+
    '<meta name="twitter:title" content="'+escapeHtml(ogTitle)+'">\n'+
    '<meta name="twitter:description" content="'+escapeHtml(ogDesc)+'">\n'+
    pushHead+
    FONT_LINK+'\n'+
    '<style id="app-style">'+CSS+'</style>\n'+
    (deviceBgCss ? '<style id="device-bg">'+deviceBgCss+'</style>\n' : '')+
    '</head><body style="'+hubFontVar+hubTextVar+hubCardVar+accentVar+bgStyle+'">\n'+
    '<div id="app"><div class="hub">'+
      '<div class="hub-avatar">'+logoInner(client.logo)+'</div>'+
      '<h1>'+escapeHtml(client.name)+'</h1>'+
      (inactive ? '<div class="tagline">Esta página no está disponible por el momento.</div>' : (client.tagline ? '<div class="tagline">'+escapeHtml(client.tagline)+'</div>' : ''))+
      (inactive ? '' : (isDirectory ? directoryHtml : '<div class="hub-links">'+contactHtml+whatsappHtml+linksHtml+'</div>'+captureHtml)+reviewsHtml)+
      '<div class="hub-footer">Creado con Espacio3d.gt</div>'+
    '</div></div>\n'+
    (isDirectory ? '<script>('+dirFilter.toString()+')();<\/script>\n' : '')+
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"><\/script>\n'+
    '<script>\n'+
    '(function(){\n'+
    '  var sb = window.supabase.createClient("'+SUPABASE_URL+'", "'+SUPABASE_ANON_KEY+'");\n'+
    '  var slug = '+JSON.stringify(client.slug)+';\n'+
    '  var ua = navigator.userAgent;\n'+
    '  var device = /iPad|Tablet/i.test(ua) ? "tablet" : (/Mobi|Android|iPhone/i.test(ua) ? "movil" : "escritorio");\n'+
    '  function logEvent(type, label){ sb.from("events").insert({client_slug:slug, type:type, button_label:label||null, device:device}).then(function(r){ if(r.error) console.error(r.error); }); }\n'+
    '  logEvent("view");\n'+
    '  var buttons = '+JSON.stringify((client.buttons||[]).map(function(b){ return b.label; }))+';\n'+
    '  document.querySelectorAll(".hub-links a[href]:not([download]):not([data-tap-extra])").forEach(function(a,i){\n'+
    '    a.addEventListener("click", function(){ logEvent("click", a.getAttribute("data-label") || buttons[i]); });\n'+
    '  });\n'+
    '  var leadBtn = document.getElementById("leadSendBtn");\n'+
    '  if(leadBtn){\n'+
    '    leadBtn.onclick = function(){\n'+
    '      var val = document.getElementById("leadInput").value.trim();\n'+
    '      if(!val) return;\n'+
    '      sb.from("leads").insert({client_slug:slug, contact:val}).then(function(r){\n'+
    '        if(!r.error){ document.getElementById("captureBox").innerHTML = "<span>¡Gracias! Ya quedó registrado.</span>"; }\n'+
    '      });\n'+
    '    };\n'+
    '  }\n'+
    rvInit+
    '})();\n'+
    '<\/script>\n'+
    pushScript+
    '</body></html>';
  return inactive ? html.replace(/<script[\s\S]*?<\/script>\n?/g, '') : html;
}

function renderNotFound(){
  return '<!doctype html>\n<html lang="es"><head>\n'+
    '<meta charset="utf-8">\n'+
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'+
    '<title>Enlace no encontrado</title>\n'+
    '<style id="app-style">'+CSS+'</style>\n'+
    '</head><body>\n'+
    '<div id="app"><div class="not-found"><h2>Enlace no encontrado</h2><p>Este tag o QR no corresponde a ningún negocio activo.</p></div></div>\n'+
    '</body></html>';
}

module.exports = async function handler(req, res){
  var slug = req.query.slug;
  if(!slug){
    res.status(404).send(renderNotFound());
    return;
  }
  try{
    var apiUrl = SUPABASE_URL+'/rest/v1/clients?slug=eq.'+encodeURIComponent(slug)+'&select=*';
    var r = await fetch(apiUrl, { headers: { apikey: SUPABASE_ANON_KEY } });
    var data = await r.json();
    var client = data && data[0];
    if(!client){
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(404).send(renderNotFound());
      return;
    }
    var proto = (req.headers['x-forwarded-proto'] || 'https');
    var pageUrl = proto+'://'+req.headers.host+'/'+encodeURIComponent(slug);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.status(200).send(renderPage(client, pageUrl));
  }catch(e){
    console.error(e);
    res.status(500).send('Error del servidor');
  }
};
