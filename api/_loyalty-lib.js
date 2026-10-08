/* ============================================================
   Shared helpers for the loyalty (tarjeta de sellos) functions.
   Files starting with "_" inside /api are NOT exposed as routes
   by Vercel — this is only required by sello.js and caja.js.

   All loyalty rules (cooldown, PIN, geo, NFC counter) live in the
   database functions from docs/supabase/03-fidelizacion.sql. These
   functions only call them with the public anon key and keep the
   customer's / cashier's key in an HttpOnly cookie set by the
   SERVER (Safari wipes JavaScript-written storage after 7 days
   without visits; server cookies don't have that limit).
   ============================================================ */

var SUPABASE_URL = "https://oifgcicvnrodipjfjkso.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZmdjaWN2bnJvZGlwamZqa3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTQ3OTksImV4cCI6MjEwNTg3MDc5OX0.rkGZ2UQhgqcFns4KpHocYXFbh5o5cgFhOV68OIwyNBQ";

// Chrome caps cookie lifetime at 400 days; we re-send it on every visit so it never expires for active customers.
var COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/* Calls a public database function. Returns its JSON result, or
   throws {reason, message} when the function raised an error. */
async function rpc(fn, args){
  var r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  var data = await r.json().catch(function(){ return null; });
  if(!r.ok){
    var err = new Error((data && data.message) || 'rpc_error');
    err.reason = (data && data.message) || 'rpc_error';
    err.hint = (data && data.hint) || '';
    throw err;
  }
  return data;
}

function readCookie(req, name){
  var all = req.headers.cookie || '';
  var parts = all.split(';');
  for(var i = 0; i < parts.length; i++){
    var kv = parts[i].trim();
    if(kv.indexOf(name + '=') === 0) return decodeURIComponent(kv.slice(name.length + 1));
  }
  return null;
}

function cookieHeader(name, value, path){
  return name + '=' + encodeURIComponent(value) +
    '; Path=' + path + '; Max-Age=' + COOKIE_MAX_AGE + '; HttpOnly; Secure; SameSite=Lax';
}

function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// JSON that is safe to drop inside a <script> tag
function jsonForScript(obj){
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function isImageUrl(s){ return /^https?:\/\//i.test(s || ''); }

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(obj));
}

function sendHtml(res, status, html){
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');   // the page depends on the visitor's cookie
  res.status(status).send(html);
}

// Turns a thrown rpc error into a JSON answer for the page
function sendRpcError(res, e){
  console.error(e);
  var known = ['locked','inactive','bad_name','bad_phone','bad_birthday','exists','no_session','bad_link','need_pin','not_found','bad_pin','promos_off'];
  if(known.indexOf(e.reason) !== -1){
    sendJson(res, 400, { ok:false, reason:e.reason, message:e.hint || '' });
  } else {
    sendJson(res, 500, { ok:false, reason:'server', message:'Error del servidor. Intenta de nuevo.' });
  }
}

/* Shared look for the customer card and the caja page: same tokens
   (and dark mode) as the hub pages in hub.js. */
var BASE_CSS = '\
:root{--bg:#F6F5F2;--surface:#FFFFFF;--surface-edge:#E6E3DB;--text:#181C1B;--text-dim:#666F6C;--accent-default:#0E7A5F;--accent-ink:#FFFFFF;--chip-bg:#EFEDE6;--danger:#C24A3B;--ok:#0E7A5F;color-scheme:light;}\
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#121615;--surface:#1C2120;--surface-edge:#2B3230;--text:#EEF1EF;--text-dim:#9AA5A1;--accent-default:#2FD1A4;--accent-ink:#0B1413;--chip-bg:#242B29;--danger:#E17A6B;--ok:#2FD1A4;color-scheme:dark;}}\
:root[data-theme="dark"]{--bg:#121615;--surface:#1C2120;--surface-edge:#2B3230;--text:#EEF1EF;--text-dim:#9AA5A1;--accent-default:#2FD1A4;--accent-ink:#0B1413;--chip-bg:#242B29;--danger:#E17A6B;--ok:#2FD1A4;color-scheme:dark;}\
*{box-sizing:border-box;}html,body{min-height:100%;}\
body{margin:0;background:var(--bg);color:var(--text);font-family:"Work Sans",-apple-system,BlinkMacSystemFont,sans-serif;padding-inline:16px;padding-block:28px;}\
h1,h2,h3{font-family:"Outfit",-apple-system,sans-serif;margin:0;text-wrap:balance;}\
#app{max-width:440px;margin:0 auto;display:flex;flex-direction:column;gap:16px;}\
.head{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;color:var(--head-text,var(--text));}\
.head .sub{color:inherit;opacity:.75;}\
h1,h2,.btn,.count b{font-family:var(--brand-font,"Outfit"),-apple-system,sans-serif;}\
.avatar{width:68px;height:68px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;color:#fff;background:var(--accent,var(--accent-default));overflow:hidden;}\
.avatar img{width:100%;height:100%;object-fit:contain;}\
.sub{color:var(--text-dim);font-size:14px;}\
.card{background:var(--card-bg,var(--surface));color:var(--card-text,var(--text));border:1px solid color-mix(in srgb,var(--card-text,var(--text)) 12%,transparent);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:14px;}\
.card .sub,.card .reward-line,.card .field label,.card .check,.card .link{color:color-mix(in srgb,var(--card-text,var(--text)) 65%,transparent);}\
.field{display:flex;flex-direction:column;gap:6px;}\
.field label{font-size:13px;font-weight:600;color:var(--text-dim);}\
.field input{background:color-mix(in srgb,var(--card-text,var(--text)) 6%,transparent);border:1px solid color-mix(in srgb,var(--card-text,var(--text)) 15%,transparent);border-radius:10px;padding:12px;font-size:16px;color:var(--text);font-family:inherit;width:100%;}\
.check{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--text-dim);}\
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:12px;padding:14px 18px;font-size:16px;font-weight:600;cursor:pointer;font-family:"Outfit",sans-serif;width:100%;text-decoration:none;}\
.btn-primary{background:var(--accent,var(--accent-default));color:var(--accent-ink-custom,var(--accent-ink));}\
.btn-ghost{background:color-mix(in srgb,var(--card-text,var(--text)) 8%,transparent);color:inherit;}\
.btn:disabled{opacity:.6;cursor:default;}\
.link{background:none;border:none;color:var(--text-dim);font-size:14px;text-decoration:underline;cursor:pointer;font-family:inherit;padding:4px;}\
.msg{border-radius:14px;padding:14px 16px;font-size:15px;line-height:1.4;text-align:center;}\
.msg-ok{background:color-mix(in srgb,var(--accent,var(--ok)) 16%,var(--card-bg,var(--surface)));color:var(--card-text,var(--text));}\
.msg-warn{background:var(--card-bg,var(--surface));color:var(--card-text,var(--text));}\
.msg-err{background:color-mix(in srgb,var(--danger) 16%,var(--card-bg,var(--surface)));color:var(--card-text,var(--text));}\
.foot{color:var(--head-text,var(--text-dim));opacity:.7;font-size:12px;text-align:center;}\
.hidden{display:none !important;}\
';

var FONT_LINK = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Work+Sans:wght@400;500;600&family=Poppins:wght@500;600;700&family=Playfair+Display:wght@600;700&family=Montserrat:wght@500;600;700&family=Bebas+Neue&family=Fraunces:wght@600;700&family=Quicksand:wght@500;600;700&family=Oswald:wght@500;600;700&family=Abril+Fatface&family=DM+Serif+Display&family=Righteous&family=Pacifico&family=Caveat:wght@600;700&display=swap">';

// Same font keys as the panel and hub.js
var FONTS = {
  poppins:"'Poppins',sans-serif", playfair:"'Playfair Display',serif", montserrat:"'Montserrat',sans-serif",
  bebas:"'Bebas Neue',sans-serif", fraunces:"'Fraunces',serif", quicksand:"'Quicksand',sans-serif",
  oswald:"'Oswald',sans-serif", abril:"'Abril Fatface',serif", dmserif:"'DM Serif Display',serif",
  righteous:"'Righteous',sans-serif", pacifico:"'Pacifico',cursive", caveat:"'Caveat',cursive"
};

function isHexColor(s){ return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s || ''); }

function contrastTextColor(hex){
  var h = (hex||'').replace('#','');
  if(h.length === 3){ h = h.split('').map(function(c){ return c+c; }).join(''); }
  var r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
  if(isNaN(r) || isNaN(g) || isNaN(b)) return '';
  return (r*299 + g*587 + b*114) / 1000 >= 150 ? '#181C1B' : '#FFFFFF';
}

/* Resolves the card's look: the program's own design (set in the
   panel's "Diseño de la tarjeta") wins; anything left empty falls
   back to the business page's look. Returns the inline <body> style
   with CSS variables plus the bits the page script needs. Every value
   is validated (hex colors / http(s) URLs / known keys) because it
   ends up inside a style attribute. */
function resolveDesign(p){
  p = p || {};
  var d = p.design || {};
  var accent = isHexColor(d.accent) ? d.accent : (isHexColor(p.accent) ? p.accent : '#0E7A5F');
  var bg = d.bg || p.background || '';
  var card = isHexColor(d.card_color) ? d.card_color : (isHexColor(p.card_color) ? p.card_color : '');
  var headText = isHexColor(d.text_color) ? d.text_color : (isHexColor(p.text_color) ? p.text_color : '');
  var fontKey = d.font || p.font;
  var font = FONTS[fontKey] || '';

  var style = '--accent:' + accent + ';';
  var ink = contrastTextColor(accent);
  if(ink) style += '--accent-ink-custom:' + ink + ';';
  if(isImageUrl(bg)){
    style += 'background-image:url(\'' + encodeURI(bg).replace(/'/g, '%27') + '\');background-size:cover;background-position:center;background-attachment:fixed;';
  } else if(isHexColor(bg)){
    style += '--bg:' + bg + ';';
    if(!headText) headText = contrastTextColor(bg);
  }
  if(card){
    style += '--card-bg:' + card + ';--card-text:' + contrastTextColor(card) + ';';
  }
  if(headText) style += '--head-text:' + headText + ';';
  if(font) style += '--brand-font:' + font + ';';

  var icon = String(d.stamp_icon || '').slice(0, 400);
  return {
    bodyStyle: style,
    subtitle: String(d.subtitle || '').slice(0, 60),
    stampIcon: (isImageUrl(icon) || (icon && icon.length <= 8)) ? icon : '',
    emptyStyle: d.empty_style === 'faded' ? 'faded' : 'number',
    shape: d.shape === 'rounded' || d.shape === 'square' ? d.shape : 'circle'
  };
}


/* Birthday field typed as DD/MM/AAAA instead of a calendar picker
   (scrolling back decades in a date picker is hard for older
   customers). Plain ES5, injected as its own <script> in the card and
   caja pages. The slashes are added automatically while typing. */
var BIRTH_JS = '(' + function(){
  window.birthInputHtml = function(id){
    return '<input id="'+id+'" type="text" inputmode="numeric" autocomplete="bday" maxlength="10" placeholder="DD/MM/AAAA" style="letter-spacing:1px;">'+
      '<div class="sub" style="font-size:12px;">Ejemplo: 14/03/1965</div>';
  };
  window.birthMask = function(el){
    el.addEventListener('input', function(){
      var d = el.value.replace(/\D/g, '').slice(0, 8);
      var out = d.slice(0, 2);
      if(d.length > 2) out += '/' + d.slice(2, 4);
      if(d.length > 4) out += '/' + d.slice(4, 8);
      el.value = out;
    });
  };
  // "14/03/1965" -> "1965-03-14", or null when it's not a real past date
  window.birthToIso = function(v){
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((v || '').trim());
    if(!m) return null;
    var day = +m[1], mon = +m[2], yr = +m[3];
    var dt = new Date(Date.UTC(yr, mon - 1, day));
    if(dt.getUTCFullYear() !== yr || dt.getUTCMonth() !== mon - 1 || dt.getUTCDate() !== day) return null;
    if(yr < 1900 || dt > new Date()) return null;
    return yr + '-' + (mon < 10 ? '0' : '') + mon + '-' + (day < 10 ? '0' : '') + day;
  };
}.toString() + ')();';

module.exports = {
  rpc: rpc,
  readCookie: readCookie,
  cookieHeader: cookieHeader,
  escapeHtml: escapeHtml,
  jsonForScript: jsonForScript,
  isImageUrl: isImageUrl,
  sendJson: sendJson,
  sendHtml: sendHtml,
  sendRpcError: sendRpcError,
  BASE_CSS: BASE_CSS,
  FONT_LINK: FONT_LINK,
  resolveDesign: resolveDesign,
  BIRTH_JS: BIRTH_JS
};
