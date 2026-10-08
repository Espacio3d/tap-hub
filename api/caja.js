/* ============================================================
   Vercel Serverless Function — página "Caja" de un negocio.
   Route: /caja/:token  (see vercel.json)

   The token is a long random secret per business, generated from
   the admin panel (loyalty_admin_new_caja_link). The cashier types
   the business PIN once; that phone then gets its own key in an
   HttpOnly cookie scoped to this path. Changing the PIN or
   regenerating the link from the panel logs every cashier phone out.

   The cashier can ONLY: look up a customer by exact phone, add a
   stamp (same cooldown), redeem the prize, register a customer.
   Nothing about the program can be changed from here.
   ============================================================ */

var L = require('./_loyalty-lib');

var COOKIE = 'e3d_caja';

function cookiePath(token){ return '/caja/' + encodeURIComponent(token); }

function renderPage(state){
  var p = state.program || {};
  var accent = p.accent || '#0E7A5F';
  return '<!doctype html>\n<html lang="es"><head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '<meta name="robots" content="noindex, nofollow">\n' +
    '<meta name="referrer" content="no-referrer">\n' +
    '<meta name="apple-mobile-web-app-capable" content="yes">\n' +
    '<meta name="apple-mobile-web-app-title" content="Caja ' + L.escapeHtml(p.name || '') + '">\n' +
    '<title>Caja · ' + L.escapeHtml(p.name || 'Sellos') + '</title>\n' +
    L.FONT_LINK + '\n' +
    '<style>' + L.BASE_CSS + PAGE_CSS + '</style>\n' +
    '</head><body style="--accent:' + L.escapeHtml(accent) + ';">\n' +
    '<div id="app"></div>\n' +
    '<script>window.__STATE__ = ' + L.jsonForScript(state) + ';<\/script>\n' +
    '<script>' + L.BIRTH_JS + '<\/script>\n' +
    '<script>' + PAGE_JS + '<\/script>\n' +
    '</body></html>';
}

var PAGE_CSS = '\
.row{display:flex;gap:8px;}\
.row input{flex:1;min-width:0;}\
.row .btn{width:auto;}\
.big-num{font-family:"Outfit",sans-serif;font-size:34px;font-weight:700;}\
.who{display:flex;justify-content:space-between;align-items:center;gap:12px;}\
.pin{text-align:center;letter-spacing:8px;font-size:24px !important;}\
.tabs{display:flex;gap:6px;background:var(--surface);border:1px solid var(--surface-edge);border-radius:14px;padding:5px;}\
.tabs button{flex:1;border:none;background:none;border-radius:10px;padding:10px 4px;font-size:14px;font-weight:600;font-family:"Outfit",sans-serif;color:var(--text-dim);cursor:pointer;}\
.tabs button.on{background:var(--accent,var(--accent-default));color:var(--accent-ink-custom,var(--accent-ink));}\
.person{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--surface-edge);}\
.person:first-child{border-top:none;}\
.person .info{flex:1;min-width:0;}\
.person .btn{width:auto;padding:10px 14px;font-size:14px;}\
.person.sent{opacity:.55;}\
textarea.msgbox{width:100%;background:color-mix(in srgb,var(--text) 6%,transparent);border:1px solid var(--surface-edge);border-radius:10px;padding:12px;font-size:16px;color:var(--text);font-family:inherit;resize:vertical;}\
';

var PAGE_JS = '(' + function(){
  var S = window.__STATE__;
  var app = document.getElementById('app');
  var P = S.program;
  var current = null;   // { id, card }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"\']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function $(id){ return document.getElementById(id); }
  function when(iso){
    try{ return new Date(iso).toLocaleString('es-GT', { timeZone:'America/Guatemala', weekday:'short', hour:'numeric', minute:'2-digit' }); }
    catch(e){ return new Date(iso).toLocaleString(); }
  }
  function post(body){
    return fetch(location.pathname, {
      method:'POST', credentials:'same-origin',
      headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body)
    }).then(function(r){ return r.json(); })
      .catch(function(){ return { ok:false, reason:'network', message:'Sin conexión. Revisa el internet.' }; });
  }
  var TAB = 'sellar';
  function head(){
    return '<div class="head"><h1>Caja · '+esc(P.name || '')+'</h1>'+
      '<div class="sub">Premio: '+esc(P.reward)+' · '+P.stamps_needed+' sellos</div></div>'+
      (P.caja_promos && TAB !== 'login' ? '<div class="tabs">'+
        '<button type="button" data-tab="sellar" class="'+(TAB==='sellar'?'on':'')+'">🎟️ Sellar</button>'+
        '<button type="button" data-tab="birthday" class="'+(TAB==='birthday'?'on':'')+'">🎂 Cumpleaños</button>'+
        '<button type="button" data-tab="promo" class="'+(TAB==='promo'?'on':'')+'">📣 Promos</button>'+
      '</div>' : '');
  }
  app.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-tab]');
    if(!t) return;
    var tab = t.getAttribute('data-tab');
    if(tab === 'sellar') renderSearch(); else renderAudience(tab);
  });
  function needPin(r){
    if(r.reason === 'need_pin'){ renderLogin({ cls:'msg-warn', text:'Ingresa el PIN de caja otra vez.' }); return true; }
    if(r.reason === 'inactive' || r.reason === 'bad_link'){ renderOff(); return true; }
    return false;
  }

  function renderOff(){
    app.innerHTML = '<div class="card"><div class="msg msg-warn">Servicio inactivo o enlace no válido. Comunícate con Espacio3d.gt.</div></div>';
  }

  function renderLogin(flash){
    TAB = 'login';
    app.innerHTML = head() +
      '<div class="card">'+
        (flash ? '<div class="msg '+flash.cls+'">'+esc(flash.text)+'</div>' : '')+
        '<div class="field"><label for="pin">PIN de caja</label>'+
        '<input id="pin" class="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off"></div>'+
        '<button class="btn btn-primary" id="loginBtn" type="button">Entrar</button>'+
        '<div class="sub" style="text-align:center;">Solo se pide una vez en este celular.</div>'+
      '</div>';
    $('pin').focus();
    $('loginBtn').onclick = function(){
      var btn = this, pin = $('pin').value.trim();
      if(!pin) return;
      btn.disabled = true;
      post({ action:'login', pin:pin }).then(function(r){
        if(r.ok){ renderSearch(); return; }
        if(r.reason === 'inactive' || r.reason === 'bad_link'){ renderOff(); return; }
        renderLogin({ cls:'msg-err', text: r.reason === 'bad_pin' ? 'PIN incorrecto.' : (r.message || 'No se pudo entrar.') });
      });
    };
  }

  function renderSearch(flash){
    current = null;
    TAB = 'sellar';
    app.innerHTML = head() +
      (flash ? '<div class="msg '+flash.cls+'">'+flash.text+'</div>' : '')+
      '<div class="card">'+
        '<div class="field"><label for="phone">Teléfono del cliente</label>'+
        '<div class="row"><input id="phone" type="tel" inputmode="tel" placeholder="5555 1234" autocomplete="off">'+
        '<button class="btn btn-primary" id="findBtn" type="button">Buscar</button></div></div>'+
      '</div>';
    $('phone').focus();
    $('phone').onkeydown = function(e){ if(e.key === 'Enter') $('findBtn').click(); };
    $('findBtn').onclick = function(){
      var phone = $('phone').value.trim();
      if(!phone) return;
      post({ action:'lookup', phone:phone }).then(function(r){
        if(needPin(r)) return;
        if(r.found){ current = { id:r.id, card:r.card }; renderCustomer(); }
        else if(r.found === false){ renderRegister(phone); }
        else { renderSearch({ cls:'msg-err', text:esc(r.message || 'Error al buscar.') }); }
      });
    };
  }

  function renderCustomer(flash){
    var c = current.card, need = P.stamps_needed;
    app.innerHTML = head() +
      (flash ? '<div class="msg '+flash.cls+'">'+flash.text+'</div>' : '')+
      '<div class="card">'+
        '<div class="who"><div><div style="font-weight:600;font-size:18px;">'+esc(c.name)+'</div>'+
          '<div class="sub">'+c.total_stamps+' sellos en total</div></div>'+
          '<div class="big-num">'+Math.min(c.balance, need)+'/'+need+'</div></div>'+
        (c.reward_ready ? '<div class="msg msg-ok">🎉 Tiene su premio listo: <b>'+esc(P.reward)+'</b></div>' : '')+
        (c.can_stamp
          ? '<button class="btn btn-primary" id="stampBtn" type="button">+1 sello</button>'
          : '<button class="btn btn-ghost" type="button" disabled>Ya selló · próximo: '+esc(when(c.next_stamp_at))+'</button>')+
        (c.reward_ready ? '<button class="btn btn-primary" id="redeemBtn" type="button">🎁 Canjear premio</button>' : '')+
        '<button class="btn btn-ghost" id="backBtn" type="button">Otro cliente</button>'+
      '</div>';
    $('backBtn').onclick = function(){ renderSearch(); };
    if($('stampBtn')) $('stampBtn').onclick = function(){ act('stamp', this); };
    if($('redeemBtn')) $('redeemBtn').onclick = function(){
      if(confirm('¿Canjear "'+P.reward+'" para '+c.name+'?')) act('redeem', this);
    };
  }

  function act(kind, btn){
    btn.disabled = true;
    post({ action:kind, customer:current.id }).then(function(r){
      if(needPin(r)) return;
      if(r.card) current.card = r.card;
      var flash;
      if(r.ok) flash = { cls:'msg-ok', text: kind === 'redeem' ? '🎁 Premio canjeado.' : '✅ Sello agregado.' };
      else if(r.reason === 'cooldown') flash = { cls:'msg-warn', text:'Este cliente ya selló. Próximo sello: '+esc(when(r.card.next_stamp_at)) };
      else if(r.reason === 'not_enough') flash = { cls:'msg-err', text:'Todavía no completa su tarjeta.' };
      else flash = { cls:'msg-err', text:esc(r.message || 'Algo salió mal.') };
      renderCustomer(flash);
    });
  }

  /* ---------- 🎂 Cumpleaños / 📣 Promos ----------
     Lists ONLY customers who accepted promotions. "Enviar" opens this
     phone's WhatsApp (the business's) with the message already written;
     the cashier just taps send. Each send is recorded so it shows
     "✓ Enviado" for everyone who uses this caja. */
  var DEFAULT_BDAY = '¡Feliz cumpleaños, {nombre}! 🎂 En {negocio} queremos celebrarte: visítanos esta semana y recibe un regalo especial. ¡Te esperamos!';
  var drafts = { birthday: null, promo: '' };

  function fill(text, c){
    var first = (c.name || '').trim().split(/\s+/)[0] || '';
    return text
      .replace(/\{nombre\}/g, first)
      .replace(/\{negocio\}/g, P.name || '')
      .replace(/\{premio\}/g, P.reward || '')
      .replace(/\{sellos\}/g, String(Math.min(c.balance, P.stamps_needed)))
      .replace(/\{faltan\}/g, String(Math.max(P.stamps_needed - c.balance, 0)))
      .replace(/\{enlace\}/g, location.origin + '/' + P.slug + '/sello');
  }
  function prettyPhone(p){ return p && p.length === 11 && p.indexOf('502') === 0 ? p.slice(3,7) + ' ' + p.slice(7) : '+' + p; }
  function wasSent(c, kind){
    if(!c.last_sent_at) return false;
    var ago = Date.now() - new Date(c.last_sent_at).getTime();
    return kind === 'birthday' ? ago < 30 * 864e5 : ago < 12 * 36e5;
  }

  function renderAudience(kind){
    TAB = kind;
    if(drafts.birthday === null) drafts.birthday = P.birthday_msg || DEFAULT_BDAY;
    app.innerHTML = head() + '<div class="card"><div class="sub">Cargando...</div></div>';
    post({ action:'audience', kind:kind }).then(function(r){
      if(needPin(r)) return;
      if(!Array.isArray(r)){
        app.innerHTML = head() + '<div class="card"><div class="msg msg-err">'+esc(r.message || 'No se pudo cargar la lista.')+'</div></div>';
        return;
      }
      var list = r;
      var isB = kind === 'birthday';

      function draw(){
        var pending = list.filter(function(c){ return !wasSent(c, kind); });
        app.innerHTML = head() +
          '<div class="card">'+
            '<h2 style="font-size:19px;">'+(isB ? '🎂 Cumpleañeros' : '📣 Enviar una promo')+'</h2>'+
            '<div class="sub" style="margin-top:-6px;">'+(isB
              ? 'Clientes que cumplen años de hoy a 7 días y aceptaron promociones.'
              : 'Se envía a todos los clientes que aceptaron recibir promociones.')+'</div>'+
            '<div class="field"><label for="msg">'+(isB ? 'Mensaje (ya viene escrito, puedes cambiarlo)' : 'Escribe tu promo')+'</label>'+
              '<textarea id="msg" class="msgbox" rows="4" placeholder="Ej: ¡Hola {nombre}! Este viernes 2x1 en café ☕">'+esc(drafts[kind])+'</textarea>'+
              '<div class="sub" style="font-size:12px;">Escribe <b>{nombre}</b> y se cambia solo por el nombre de cada cliente.</div>'+
            '</div>'+
            (list.length ? '<button class="btn btn-primary" id="nextBtn" type="button"'+(pending.length ? '' : ' disabled')+'>'+
              (pending.length ? '▶ Enviar al siguiente ('+pending.length+' pendiente'+(pending.length===1?'':'s')+')' : '✓ Ya se envió a todos')+'</button>' : '')+
          '</div>'+
          '<div class="card">'+
            '<div class="sub">'+list.length+' cliente'+(list.length===1?'':'s')+' · '+(list.length - pending.length)+' enviado'+(list.length - pending.length===1?'':'s')+'</div>'+
            (list.length ? '<div>'+list.map(function(c){
              var sent = wasSent(c, kind);
              var info = isB ? (c.days === 0 ? '🎂 ¡Hoy!' : (c.days === 1 ? '🎂 Mañana' : '🎂 En '+c.days+' días'))
                             : Math.min(c.balance, P.stamps_needed)+'/'+P.stamps_needed+' sellos';
              return '<div class="person'+(sent?' sent':'')+'"><div class="info"><b>'+esc(c.name)+'</b>'+
                '<div class="sub" style="font-size:13px;">'+esc(prettyPhone(c.phone))+' · '+info+'</div></div>'+
                '<button class="btn '+(sent?'btn-ghost':'btn-primary')+'" type="button" data-send="'+esc(c.id)+'">'+(sent?'✓ Enviado':'Enviar')+'</button></div>';
            }).join('')+'</div>'
            : '<div class="sub">'+(isB ? 'No hay cumpleañeros esta semana.' : 'Todavía nadie ha aceptado recibir promociones.')+'</div>')+
          '</div>';

        $('msg').oninput = function(){ drafts[kind] = this.value; };
        if($('nextBtn')) $('nextBtn').onclick = function(){
          var next = list.filter(function(c){ return !wasSent(c, kind); })[0];
          if(next) send(next);
        };
        app.querySelectorAll('[data-send]').forEach(function(btn){
          btn.onclick = function(){
            var c = list.filter(function(x){ return x.id === btn.getAttribute('data-send'); })[0];
            if(c) send(c);
          };
        });
      }

      function send(c){
        var text = (drafts[kind] || '').trim();
        if(!text){ alert('Primero escribe el mensaje.'); $('msg').focus(); return; }
        window.open('https://wa.me/' + c.phone + '?text=' + encodeURIComponent(fill(text, c)), '_blank');
        c.last_sent_at = new Date().toISOString();
        post({ action:'sent', customer:c.id, kind:kind });
        draw();
      }

      draw();
    });
  }

  function renderRegister(phone, flash){
    app.innerHTML = head() +
      '<div class="card">'+
        '<h2 style="font-size:19px;">Cliente nuevo</h2>'+
        '<div class="sub" style="margin-top:-6px;">No hay tarjeta con ese teléfono. Regístralo y se le suma su primer sello.</div>'+
        (flash ? '<div class="msg '+flash.cls+'">'+esc(flash.text)+'</div>' : '')+
        '<div class="field"><label for="rName">Nombre</label><input id="rName" autocomplete="off"></div>'+
        '<div class="field"><label for="rPhone">Teléfono</label><input id="rPhone" type="tel" inputmode="tel" value="'+esc(phone)+'"></div>'+
        '<div class="field"><label for="rBirth">Fecha de nacimiento</label>'+birthInputHtml('rBirth')+'</div>'+
        '<div class="sub">Con su teléfono y fecha de nacimiento podrá abrir su tarjeta en su celular cuando quiera.</div>'+
        '<button class="btn btn-primary" id="regBtn" type="button">Registrar y sellar</button>'+
        '<button class="btn btn-ghost" id="backBtn" type="button">Cancelar</button>'+
      '</div>';
    $('rName').focus();
    birthMask($('rBirth'));
    $('backBtn').onclick = function(){ renderSearch(); };
    $('regBtn').onclick = function(){
      var body = { action:'register', name:$('rName').value, phone:$('rPhone').value, birthday:birthToIso($('rBirth').value) };
      if(!body.name.trim()){ $('rName').focus(); return; }
      if(!body.birthday){ alert('Escribe la fecha así: día/mes/año, por ejemplo 14/03/1965.'); $('rBirth').focus(); return; }
      this.disabled = true;
      post(body).then(function(r){
        if(needPin(r)) return;
        if(r.ok){ current = { id:r.id, card:r.card }; renderCustomer({ cls:'msg-ok', text:'✅ Cliente registrado con su primer sello.' }); }
        else renderRegister(body.phone, { cls:'msg-err', text: r.message || 'No se pudo registrar.' });
      });
    };
  }

  if(!P || !P.enabled){ renderOff(); return; }
  if(S.authed) renderSearch(); else renderLogin();
}.toString() + ')();';

module.exports = async function handler(req, res){
  var token = String(req.query.token || '');
  if(!/^[A-Za-z0-9]{20,64}$/.test(token)){ L.sendHtml(res, 404, 'Enlace no encontrado'); return; }
  var device = L.readCookie(req, COOKIE);

  if(req.method === 'POST'){
    var b = req.body || {};
    if(typeof b === 'string'){ try{ b = JSON.parse(b); }catch(e){ b = {}; } }
    try{
      var r;
      if(b.action === 'login'){
        r = await L.rpc('loyalty_caja_login', { p_caja: token, p_pin: String(b.pin || '') });
        if(r.ok && r.device){
          res.setHeader('Set-Cookie', L.cookieHeader(COOKIE, r.device, cookiePath(token)));
          delete r.device;
        }
        L.sendJson(res, 200, r);
        return;
      }
      if(!device){ L.sendJson(res, 200, { ok:false, reason:'need_pin' }); return; }
      if(b.action === 'lookup'){
        r = await L.rpc('loyalty_caja_lookup', { p_caja: token, p_device: device, p_phone: String(b.phone || '') });
      } else if(b.action === 'stamp' || b.action === 'redeem'){
        r = await L.rpc('loyalty_caja_action', { p_caja: token, p_device: device, p_customer: String(b.customer || ''), p_action: b.action });
      } else if(b.action === 'audience'){
        r = await L.rpc('loyalty_caja_audience', { p_caja: token, p_device: device, p_kind: b.kind === 'promo' ? 'promo' : 'birthday' });
      } else if(b.action === 'sent'){
        r = await L.rpc('loyalty_caja_mark_sent', {
          p_caja: token, p_device: device, p_customer: String(b.customer || ''), p_kind: b.kind === 'promo' ? 'promo' : 'birthday' });
      } else if(b.action === 'register'){
        r = await L.rpc('loyalty_caja_register', {
          p_caja: token, p_device: device, p_name: String(b.name || ''), p_phone: String(b.phone || ''), p_birthday: b.birthday || null });
      } else {
        L.sendJson(res, 400, { ok:false, reason:'bad_action' });
        return;
      }
      L.sendJson(res, 200, r);
    }catch(e){
      L.sendRpcError(res, e);
    }
    return;
  }

  try{
    var data = await L.rpc('loyalty_caja_info', { p_caja: token, p_device: device });
    if(!data.program){ L.sendHtml(res, 404, 'Enlace no encontrado'); return; }
    if(data.authed) res.setHeader('Set-Cookie', L.cookieHeader(COOKIE, device, cookiePath(token)));
    L.sendHtml(res, 200, renderPage({ program: data.program, authed: !!data.authed }));
  }catch(e){
    console.error(e);
    L.sendHtml(res, 500, 'Error del servidor');
  }
};
