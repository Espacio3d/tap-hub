/* ============================================================
   Vercel Serverless Function — tarjeta de sellos del cliente final.
   Route: /:slug/sello  (see vercel.json)

   GET  → renders the card page. The NFC sticker and the printed QR
          point here with ?via=nfc or ?via=qr (NFC can also carry
          &m=<UID>x<COUNTER> from the NTAG215 mirror feature). Opening
          it without ?via (short link, WhatsApp link, home-screen
          icon) only shows the card — it never stamps.
   POST → JSON actions from that page: register, recover, stamp, pin.

   The customer's key lives in an HttpOnly cookie scoped to this
   path, set here on the server; the page itself never sees it.
   ============================================================ */

var L = require('./_loyalty-lib');

var COOKIE = 'e3d_t';

function cookiePath(slug){ return '/' + encodeURIComponent(slug) + '/sello'; }

// NTAG215 "UID + counter" mirror looks like 04A1B2C3D4E5F6x00002A
function parseMirror(m){
  var match = /^([0-9A-Fa-f]{14})x([0-9A-Fa-f]{6})$/.exec(m || '');
  if(!match) return { uid:null, ctr:null };
  return { uid: match[1].toUpperCase(), ctr: parseInt(match[2], 16) };
}

function renderPage(state){
  var p = state.program || {};
  var look = L.resolveDesign(p);
  state.look = { subtitle: look.subtitle, stampIcon: look.stampIcon, emptyStyle: look.emptyStyle, shape: look.shape };
  var bodyStyle = look.bodyStyle;
  var title = p.name ? 'Tarjeta de sellos · ' + p.name : 'Tarjeta de sellos';

  return '<!doctype html>\n<html lang="es"><head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '<meta name="robots" content="noindex">\n' +
    '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
    '<meta name="apple-mobile-web-app-title" content="' + L.escapeHtml(p.name || 'Mis sellos') + '">\n' +
    (p.logo && L.isImageUrl(p.logo) ? '<link rel="apple-touch-icon" href="' + L.escapeHtml(p.logo) + '">\n' : '') +
    '<title>' + L.escapeHtml(title) + '</title>\n' +
    L.FONT_LINK + '\n' +
    '<style>' + L.BASE_CSS + PAGE_CSS + '</style>\n' +
    '</head><body class="shape-' + look.shape + '" style="' + L.escapeHtml(bodyStyle) + '">\n' +
    '<div id="app"></div>\n' +
    '<script>window.__STATE__ = ' + L.jsonForScript(state) + ';<\/script>\n' +
    '<script>' + L.BIRTH_JS + '<\/script>\n' +
    '<script>' + PAGE_JS + '<\/script>\n' +
    '</body></html>';
}

var PAGE_CSS = '\
.stamps{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:10px;justify-items:center;}\
.stamp{width:52px;height:52px;border-radius:50%;border:2px dashed color-mix(in srgb,var(--card-text,var(--text)) 22%,transparent);display:flex;align-items:center;justify-content:center;color:color-mix(in srgb,var(--card-text,var(--text)) 55%,transparent);font-size:13px;font-weight:600;overflow:hidden;}\
.shape-rounded .stamp{border-radius:14px;}\
.shape-square .stamp{border-radius:4px;}\
.stamp.on{border:none;background:var(--accent,var(--accent-default));color:var(--accent-ink-custom,var(--accent-ink));}\
.stamp.on svg{width:26px;height:26px;}\
.stamp .ico{font-size:26px;line-height:1;}\
.stamp img.ico{width:70%;height:70%;object-fit:contain;}\
.stamp.faded .ico{opacity:.28;filter:grayscale(1);}\
.stamp.new{animation:pop .5s ease-out;}\
@keyframes pop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}\
.count{display:flex;justify-content:space-between;align-items:baseline;}\
.count b{font-family:"Outfit",sans-serif;font-size:28px;}\
.reward-line{font-size:14px;color:var(--text-dim);}\
.prize{text-align:center;display:flex;flex-direction:column;gap:6px;}\
.prize .big{font-size:40px;}\
.pin-row{display:flex;gap:8px;}\
.pin-row input{flex:1;min-width:0;text-align:center;letter-spacing:6px;font-size:20px;background:var(--bg);border:1px solid var(--surface-edge);border-radius:12px;padding:10px 12px;color:var(--text);font-family:inherit;}\
.pin-row .btn{width:auto;}\
';

/* Client-side script for the card page. Plain ES5 so it runs on old phones. */
var PAGE_JS = '(' + function(){
  var S = window.__STATE__;
  var app = document.getElementById('app');
  var P = S.program;
  var card = S.customer;
  var pendingVia = S.via;            // stamp once, then forget it
  var mirror = S.m;

  // Remove ?via / ?m from the address bar so a reload, a bookmark or
  // "Agregar a inicio" never stamps again by itself.
  if(location.search){ try{ history.replaceState(null, '', location.pathname); }catch(e){} }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"\']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function $(id){ return document.getElementById(id); }
  function when(iso){
    try{
      return new Date(iso).toLocaleString('es-GT', { timeZone:'America/Guatemala', weekday:'long', day:'numeric', month:'short', hour:'numeric', minute:'2-digit' });
    }catch(e){ return new Date(iso).toLocaleString(); }
  }
  function post(body){
    return fetch(location.pathname, {
      method:'POST', credentials:'same-origin',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    }).then(function(r){ return r.json(); })
      .catch(function(){ return { ok:false, reason:'network', message:'Sin conexión. Revisa tu internet e intenta de nuevo.' }; });
  }

  function headHtml(){
    var logo = /^https?:\/\//i.test(P.logo || '') ? '<img src="'+esc(P.logo)+'" alt="">' : esc(P.logo || (P.name||'•').charAt(0));
    return '<div class="head"><div class="avatar">'+logo+'</div><h1>'+esc(P.name || 'Tarjeta de sellos')+'</h1>'+
      '<div class="sub">'+esc((S.look && S.look.subtitle) || 'Tarjeta de sellos')+'</div></div>';
  }
  var LOOK = S.look || {};
  var ICON = !LOOK.stampIcon ? '' : (/^https?:\/\//i.test(LOOK.stampIcon)
    ? '<img class="ico" src="'+esc(LOOK.stampIcon)+'" alt="">' : '<span class="ico">'+esc(LOOK.stampIcon)+'</span>');
  var CHECK = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- messages for every result the database can give ---------- */
  function resultMessage(r){
    if(r.ok) return { cls:'msg-ok', text:'✅ ¡Sello agregado! Gracias por tu visita.' };
    switch(r.reason){
      case 'cooldown': return { cls:'msg-warn', text:'✓ Ya marcaste tu sello.' + (r.card && r.card.next_stamp_at ? ' Próximo sello: ' + when(r.card.next_stamp_at) : '') };
      case 'replay':   return { cls:'msg-warn', text:'Ese toque ya se usó. Vuelve a acercar tu celular al sticker.' };
      case 'bad_tag':  return { cls:'msg-err',  text:'Este sticker no es válido. Avísale al personal.' };
      case 'need_geo': return { cls:'msg-err',  text:'Para sellar con QR necesitamos tu ubicación. Actívala y vuelve a escanear.' };
      case 'too_far':  return { cls:'msg-err',  text:'Debes estar en el negocio para sellar.' };
      case 'bad_pin':  return { cls:'msg-err',  text:'PIN incorrecto.' };
      case 'not_enough': return { cls:'msg-err', text:'Todavía no completas tu tarjeta.' };
      default: return { cls:'msg-err', text: r.message || 'Algo salió mal. Intenta de nuevo.' };
    }
  }

  /* ---------- views ---------- */
  function renderInactive(){
    app.innerHTML = (P ? headHtml() : '') +
      '<div class="card"><div class="msg msg-warn">La tarjeta de sellos no está disponible en este momento.</div></div>'+
      '<div class="foot">Creado con Espacio3d.gt</div>';
  }

  function renderRegister(mode, flash, prefill){
    var isNew = mode !== 'recover';
    app.innerHTML = headHtml() +
      '<div class="card">'+
        '<h2 style="font-size:20px;">'+(isNew ? 'Crea tu tarjeta' : 'Ya tengo tarjeta')+'</h2>'+
        '<div class="sub" style="margin-top:-6px;">'+(isNew
          ? 'Junta '+P.stamps_needed+' sellos y gana: <b>'+esc(P.reward)+'</b>. Solo la primera vez.'
          : 'Escribe el teléfono y la fecha de nacimiento con los que te registraste.')+'</div>'+
        (flash ? '<div class="msg '+flash.cls+'">'+esc(flash.text)+'</div>' : '')+
        (isNew ? '<div class="field"><label for="fName">Nombre</label><input id="fName" autocomplete="name" placeholder="Tu nombre"></div>' : '')+
        '<div class="field"><label for="fPhone">Teléfono / WhatsApp</label><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="5555 1234"></div>'+
        '<div class="field"><label for="fBirth">Fecha de nacimiento</label>'+birthInputHtml('fBirth')+'</div>'+
        (isNew && P.ask_email ? '<div class="field"><label for="fEmail">Correo (opcional)</label><input id="fEmail" type="email" autocomplete="email" placeholder="tu@correo.com"></div>' : '')+
        (isNew ? '<label class="check"><input type="checkbox" id="fMkt"> Acepto recibir promociones de '+esc(P.name || 'este negocio')+'.</label>' : '')+
        '<button class="btn btn-primary" id="fSend" type="button">'+(isNew ? 'Crear mi tarjeta' : 'Recuperar mi tarjeta')+'</button>'+
        '<button class="link" id="fSwitch" type="button">'+(isNew ? '¿Ya tienes tarjeta? Entra aquí' : 'Soy nuevo, crear tarjeta')+'</button>'+
      '</div>'+
      '<div class="foot">Tus datos solo los usa '+esc(P.name || 'el negocio')+' para tu tarjeta. · Espacio3d.gt</div>';

    $('fSwitch').onclick = function(){ renderRegister(isNew ? 'recover' : 'new'); };
    birthMask($('fBirth'));
    // Keep what the person already typed when we show an error
    if(prefill){ ['fName','fPhone','fBirth','fEmail'].forEach(function(id){ if($(id) && prefill[id]) $(id).value = prefill[id]; }); }
    function typed(){ var o = {}; ['fName','fPhone','fBirth','fEmail'].forEach(function(id){ if($(id)) o[id] = $(id).value; }); return o; }
    $('fSend').onclick = function(){
      var btn = this;
      var body = isNew ? {
        action:'register', name:$('fName').value, phone:$('fPhone').value, birthday:birthToIso($('fBirth').value),
        email: $('fEmail') ? $('fEmail').value : '', marketing: $('fMkt').checked
      } : { action:'recover', phone:$('fPhone').value, birthday:birthToIso($('fBirth').value) };
      if(isNew && !body.name.trim()){ $('fName').focus(); return; }
      if(!body.phone.trim()){ $('fPhone').focus(); return; }
      if(!body.birthday){
        renderRegister(mode, { cls:'msg-err', text:'Escribe tu fecha de nacimiento así: día/mes/año, por ejemplo 14/03/1965.' }, typed());
        return;
      }
      var saved = typed();
      btn.disabled = true; btn.textContent = 'Un momento...';
      post(body).then(function(r){
        if(!r.ok){
          var text = r.reason === 'not_found' ? 'No encontramos una tarjeta con esos datos.' : (r.message || 'Algo salió mal. Intenta de nuevo.');
          renderRegister(mode, { cls:'msg-err', text:text }, saved);
          return;
        }
        card = r.card;
        if(pendingVia){ doStamp(isNew ? '🎉 ¡Listo, ' + firstName() + '! Tu tarjeta quedó creada.' : null); }
        else { renderCard({ cls:'msg-ok', text: isNew ? '🎉 ¡Listo! Tu tarjeta quedó creada.' : '👋 ¡Hola de nuevo, ' + firstName() + '!' }); }
      });
    };
  }

  function firstName(){ return esc(((card && card.name) || '').split(' ')[0]); }

  function renderCard(flash, justStamped){
    var need = P.stamps_needed, bal = card.balance;
    var dots = '';
    for(var i = 0; i < need; i++){
      var on = i < bal;
      var isNew = justStamped && i === Math.min(bal, need) - 1;
      var faded = !on && LOOK.emptyStyle === 'faded' && ICON;
      dots += '<div class="stamp'+(on?' on':'')+(isNew?' new':'')+(faded?' faded':'')+'">'+(on ? (ICON || CHECK) : (faded ? ICON : (i+1)))+'</div>';
    }
    var extra = bal > need ? '<div class="reward-line">+'+(bal-need)+' sellos extra para tu próxima tarjeta</div>' : '';

    var prize = card.reward_ready ?
      '<div class="card prize">'+
        '<div class="big">🎉</div><h2>¡Ganaste!</h2><div style="font-size:18px;font-weight:600;">'+esc(P.reward)+'</div>'+
        '<div class="sub">Muéstrale esta pantalla al cajero para canjear.</div>'+
        '<div class="pin-row"><input id="pinRedeem" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="PIN" autocomplete="off">'+
        '<button class="btn btn-primary" id="redeemBtn" type="button">Canjear</button></div>'+
      '</div>' : '';

    app.innerHTML = headHtml() +
      (flash ? '<div class="msg '+flash.cls+'">'+flash.text+'</div>' : '') +
      prize +
      '<div class="card">'+
        '<div class="count"><span>Hola, <b style="font-size:inherit;font-family:inherit;">'+esc(card.name)+'</b></span><b>'+Math.min(bal,need)+'/'+need+'</b></div>'+
        '<div class="stamps">'+dots+'</div>'+ extra +
        '<div class="reward-line">Premio al completar: <b>'+esc(P.reward)+'</b></div>'+
        (!card.can_stamp && card.next_stamp_at ? '<div class="reward-line">Próximo sello disponible: '+esc(when(card.next_stamp_at))+'</div>' : '')+
      '</div>'+
      '<div class="card">'+
        '<a class="btn btn-ghost" id="waBtn" target="_blank" rel="noopener">📲 Guardar mi tarjeta en WhatsApp</a>'+
        '<button class="link" id="homeTipBtn" type="button">Agregar a la pantalla de inicio</button>'+
        '<div id="homeTip" class="sub hidden" style="text-align:center;">En iPhone: toca <b>Compartir</b> ⬆️ y luego <b>Agregar a inicio</b>. En Android: menú ⋮ y <b>Agregar a pantalla principal</b>.</div>'+
      '</div>'+
      '<div class="card">'+
        '<button class="link" id="cashierToggle" type="button">¿No pudiste sellar? Pídele al cajero</button>'+
        '<div id="cashierBox" class="hidden" style="display:flex;flex-direction:column;gap:8px;">'+
          '<div class="sub">El cajero escribe su PIN para sumarte el sello.</div>'+
          '<div class="pin-row"><input id="pinStamp" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="PIN" autocomplete="off">'+
          '<button class="btn btn-primary" id="pinStampBtn" type="button">Sellar</button></div>'+
        '</div>'+
      '</div>'+
      '<div class="foot">Creado con Espacio3d.gt</div>';

    var shareUrl = location.origin + location.pathname;
    $('waBtn').href = 'https://wa.me/?text=' + encodeURIComponent('Mi tarjeta de sellos de ' + (P.name || '') + ': ' + shareUrl);
    $('homeTipBtn').onclick = function(){ $('homeTip').classList.toggle('hidden'); };
    $('cashierToggle').onclick = function(){ $('cashierBox').classList.toggle('hidden'); };
    $('pinStampBtn').onclick = function(){ pinAction('stamp', $('pinStamp'), this); };
    if($('redeemBtn')) $('redeemBtn').onclick = function(){ pinAction('redeem', $('pinRedeem'), this); };
  }

  function pinAction(kind, input, btn){
    var pin = input.value.trim();
    if(!pin){ input.focus(); return; }
    btn.disabled = true;
    post({ action:'pin', pinAction:kind, pin:pin }).then(function(r){
      if(r.card) card = r.card;
      if(r.ok && kind === 'redeem'){ renderCard({ cls:'msg-ok', text:'🎁 ¡Premio canjeado! Disfruta tu ' + esc(r.reward || P.reward) + '.' }); return; }
      var m = resultMessage(r);
      renderCard({ cls:m.cls, text:esc(m.text) }, r.ok);
    });
  }

  function doStamp(prefix){
    var via = pendingVia;
    pendingVia = null;
    app.innerHTML = headHtml() + '<div class="card"><div class="msg msg-warn">Marcando tu sello...</div></div>';
    function send(lat, lng){
      post({ action:'stamp', via:via, m:mirror, lat:lat, lng:lng }).then(function(r){
        if(r.reason === 'no_session'){ card = null; renderRegister('recover', { cls:'msg-warn', text:'Vuelve a entrar a tu tarjeta.' }); return; }
        if(r.card) card = r.card;
        if(!card){ renderRegister('new', { cls:'msg-err', text: r.message || 'Algo salió mal.' }); return; }
        var m = resultMessage(r);
        renderCard({ cls:m.cls, text:(prefix ? prefix + '<br>' : '') + esc(m.text) }, r.ok);
      });
    }
    if(via === 'qr' && P.require_geo_qr){
      if(!navigator.geolocation){ send(null, null); return; }
      navigator.geolocation.getCurrentPosition(
        function(pos){ send(pos.coords.latitude, pos.coords.longitude); },
        function(){ send(null, null); },
        { enableHighAccuracy:true, timeout:12000, maximumAge:60000 }
      );
    } else {
      send(null, null);
    }
  }

  /* ---------- start ---------- */
  if(!P || !P.enabled){ renderInactive(); return; }
  if(!card){ renderRegister('new', pendingVia ? { cls:'msg-warn', text:'Regístrate una sola vez y te sumamos tu primer sello.' } : null); return; }
  if(pendingVia){ doStamp(null); } else { renderCard(null); }
}.toString() + ')();';

module.exports = async function handler(req, res){
  var slug = String(req.query.slug || '').toLowerCase();
  if(!/^[a-z0-9-]{1,48}$/.test(slug)){ L.sendHtml(res, 404, 'Enlace no encontrado'); return; }
  var token = L.readCookie(req, COOKIE);

  if(req.method === 'POST'){
    var b = req.body || {};
    if(typeof b === 'string'){ try{ b = JSON.parse(b); }catch(e){ b = {}; } }
    try{
      var r;
      if(b.action === 'register' || b.action === 'recover'){
        r = b.action === 'register'
          ? await L.rpc('loyalty_register', {
              p_slug: slug, p_name: String(b.name || ''), p_phone: String(b.phone || ''),
              p_birthday: b.birthday || null, p_email: String(b.email || ''), p_marketing: !!b.marketing })
          : await L.rpc('loyalty_recover', { p_slug: slug, p_phone: String(b.phone || ''), p_birthday: b.birthday || null });
        if(r.ok && r.token){
          res.setHeader('Set-Cookie', L.cookieHeader(COOKIE, r.token, cookiePath(slug)));
          delete r.token;   // the page never needs to see the key
        }
        L.sendJson(res, 200, r);
        return;
      }
      if(!token){ L.sendJson(res, 200, { ok:false, reason:'no_session' }); return; }
      if(b.action === 'stamp'){
        var via = b.via === 'qr' ? 'qr' : 'nfc';
        var mm = parseMirror(b.m);
        var lat = typeof b.lat === 'number' ? b.lat : null;
        var lng = typeof b.lng === 'number' ? b.lng : null;
        r = await L.rpc('loyalty_stamp', { p_slug: slug, p_token: token, p_via: via, p_uid: mm.uid, p_ctr: mm.ctr, p_lat: lat, p_lng: lng });
        L.sendJson(res, 200, r);
        return;
      }
      if(b.action === 'pin'){
        r = await L.rpc('loyalty_pin_action', {
          p_slug: slug, p_token: token, p_pin: String(b.pin || ''), p_action: b.pinAction === 'redeem' ? 'redeem' : 'stamp' });
        L.sendJson(res, 200, r);
        return;
      }
      L.sendJson(res, 400, { ok:false, reason:'bad_action' });
    }catch(e){
      L.sendRpcError(res, e);
    }
    return;
  }

  try{
    var data = await L.rpc('loyalty_card', { p_slug: slug, p_token: token });
    if(token && data.customer){
      // Re-send the cookie on every visit so it keeps living as long as the customer keeps coming.
      res.setHeader('Set-Cookie', L.cookieHeader(COOKIE, token, cookiePath(slug)));
    }
    var via = req.query.via === 'nfc' || req.query.via === 'qr' ? req.query.via : null;
    var m = typeof req.query.m === 'string' ? req.query.m.slice(0, 40) : null;
    L.sendHtml(res, data.program ? 200 : 404, renderPage({
      slug: slug, program: data.program, customer: data.customer, via: via, m: m
    }));
  }catch(e){
    console.error(e);
    L.sendHtml(res, 500, 'Error del servidor');
  }
};
