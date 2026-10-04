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
  function head(){
    return '<div class="head"><h1>Caja · '+esc(P.name || '')+'</h1>'+
      '<div class="sub">Premio: '+esc(P.reward)+' · '+P.stamps_needed+' sellos</div></div>';
  }
  function needPin(r){
    if(r.reason === 'need_pin'){ renderLogin({ cls:'msg-warn', text:'Ingresa el PIN de caja otra vez.' }); return true; }
    if(r.reason === 'inactive' || r.reason === 'bad_link'){ renderOff(); return true; }
    return false;
  }

  function renderOff(){
    app.innerHTML = '<div class="card"><div class="msg msg-warn">Servicio inactivo o enlace no válido. Comunícate con Espacio3d.gt.</div></div>';
  }

  function renderLogin(flash){
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

  function renderRegister(phone, flash){
    app.innerHTML = head() +
      '<div class="card">'+
        '<h2 style="font-size:19px;">Cliente nuevo</h2>'+
        '<div class="sub" style="margin-top:-6px;">No hay tarjeta con ese teléfono. Regístralo y se le suma su primer sello.</div>'+
        (flash ? '<div class="msg '+flash.cls+'">'+esc(flash.text)+'</div>' : '')+
        '<div class="field"><label for="rName">Nombre</label><input id="rName" autocomplete="off"></div>'+
        '<div class="field"><label for="rPhone">Teléfono</label><input id="rPhone" type="tel" inputmode="tel" value="'+esc(phone)+'"></div>'+
        '<div class="field"><label for="rBirth">Fecha de nacimiento</label><input id="rBirth" type="date" max="'+new Date().toISOString().slice(0,10)+'"></div>'+
        '<div class="sub">Con su teléfono y fecha de nacimiento podrá abrir su tarjeta en su celular cuando quiera.</div>'+
        '<button class="btn btn-primary" id="regBtn" type="button">Registrar y sellar</button>'+
        '<button class="btn btn-ghost" id="backBtn" type="button">Cancelar</button>'+
      '</div>';
    $('rName').focus();
    $('backBtn').onclick = function(){ renderSearch(); };
    $('regBtn').onclick = function(){
      var body = { action:'register', name:$('rName').value, phone:$('rPhone').value, birthday:$('rBirth').value };
      if(!body.name.trim()){ $('rName').focus(); return; }
      if(!body.birthday){ $('rBirth').focus(); return; }
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
