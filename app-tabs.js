/* ============================================================
   Espacio3d.gt — bottom tab bar of a client's saved app ("📲 Acceso directo").
   Shown only inside the app opened from the home screen (or with ?pestanas
   to try it in the browser), when the panel lists 2+ pages under
   "La app incluye" (clients.app_tabs, first one = "La app abre en").
   Usage: <script src="/app-tabs.js" data-slug="x" [data-tabs="menu,home" data-accent="#hex"]></script>
   Without data-tabs it reads them from Supabase.
   ============================================================ */
(function(){
  var me = document.currentScript; if (!me) return;
  var SLUG = me.getAttribute("data-slug") || "";
  if (!/^[a-z0-9-]{1,60}$/.test(SLUG)) return;
  var q = location.search;
  var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!standalone && !/[?&]pestanas\b/.test(q)) return;

  var SB = "https://oifgcicvnrodipjfjkso.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZmdjaWN2bnJvZGlwamZqa3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTQ3OTksImV4cCI6MjEwNTg3MDc5OX0.rkGZ2UQhgqcFns4KpHocYXFbh5o5cgFhOV68OIwyNBQ";
  var PAGES = { home: ["", "ℹ️", "Info"], menu: ["/menu", "🍽️", "Menú"], recetas: ["/recetas", "📖", "Recetas"], sello: ["/sello", "⭐", "Sellos"] };
  var base = "/" + SLUG;

  function run(tabs, accent){
    var list = String(tabs || "home").split(",").filter(function(k){ return PAGES[k]; });
    if (!list.length) return;
    var here = location.pathname.replace(/\/+$/, "");
    var cur = list.filter(function(k){ return base + PAGES[k][0] === here; })[0];

    // Opening the app: start on the page chosen in "La app abre en".
    // Links with their own parameters (a notification, ?p=product) are left alone.
    var first = true;
    try { first = !sessionStorage.getItem("e3-app-" + SLUG); sessionStorage.setItem("e3-app-" + SLUG, "1"); } catch(e){}
    var launch = /^\?app=1$/.test(q) || (!q && !document.referrer);
    if (standalone && first && launch && cur !== list[0]){ location.replace(base + PAGES[list[0]][0] + "?app=1"); return; }

    if (list.length < 2) return;
    var on = /^#[0-9a-fA-F]{6}$/.test(accent || "") ? accent + "33" : "rgba(0,0,0,.07)";
    var st = document.createElement("style");
    st.textContent =
      ".e3-tabs{position:fixed;left:0;right:0;bottom:0;z-index:38;display:flex;gap:4px;padding:6px 8px max(6px,env(safe-area-inset-bottom));" +
      "background:rgba(255,255,255,.96);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-top:1px solid rgba(0,0,0,.08);font-family:system-ui,-apple-system,sans-serif}" +
      ".e3-tabs a{flex:1;max-width:160px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0 5px;border-radius:14px;text-decoration:none;color:#666;font-size:11px;font-weight:600;-webkit-tap-highlight-color:transparent}" +
      ".e3-tabs a span{font-size:21px;line-height:1.1}" +
      ".e3-tabs a.on{color:#111;background:" + on + "}" +
      "html.e3-has-tabs body{padding-bottom:calc(72px + env(safe-area-inset-bottom)) !important}" +
      "html.e3-has-tabs .order,html.e3-has-tabs .install,html.e3-has-tabs .e3-box{bottom:calc(76px + env(safe-area-inset-bottom)) !important}";
    document.head.appendChild(st);
    var nav = document.createElement("nav");
    nav.className = "e3-tabs"; nav.setAttribute("aria-label", "Secciones");
    nav.innerHTML = list.map(function(k){
      var p = PAGES[k];
      return '<a href="' + base + p[0] + '"' + (k === cur ? ' class="on" aria-current="page"' : '') + '><span>' + p[1] + '</span>' + p[2] + '</a>';
    }).join("");
    nav.addEventListener("click", function(e){
      var a = e.target.closest("a");
      if (a && a.classList.contains("on")){ e.preventDefault(); scrollTo({ top: 0, behavior: "smooth" }); }
    });
    function add(){ document.body.appendChild(nav); document.documentElement.classList.add("e3-has-tabs"); }
    if (document.body) add(); else document.addEventListener("DOMContentLoaded", add);
  }

  if (me.hasAttribute("data-tabs")) return run(me.getAttribute("data-tabs"), me.getAttribute("data-accent"));
  fetch(SB + "/rest/v1/clients?slug=eq." + SLUG + "&select=app_tabs,accent,app_enabled,push_enabled,active", { headers: { apikey: KEY } })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      var c = rows && rows[0];
      if (c && c.active !== false && (c.app_enabled === true || c.push_enabled === true)) run(c.app_tabs, c.accent);
    }).catch(function(){});
})();
