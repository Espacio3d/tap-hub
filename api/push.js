/* ============================================================
   Vercel Serverless Function — sends push notifications ("ofertas")
   to every phone subscribed to a client's menu.
   Route: POST /api/push   body: {slug, title, body, url}
   Header: Authorization: Bearer <panel session token>

   Only the panel admin can use it: the subscriber list is read with
   the admin's own session, and Supabase RLS (is_admin) only returns
   rows to administrators. The VAPID private key lives in the Vercel
   environment variable VAPID_PRIVATE_KEY — never in this file
   (the repository is public).
   ============================================================ */

var webpush = require('web-push');

var SUPABASE_URL = "https://oifgcicvnrodipjfjkso.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZmdjaWN2bnJvZGlwamZqa3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTQ3OTksImV4cCI6MjEwNTg3MDc5OX0.rkGZ2UQhgqcFns4KpHocYXFbh5o5cgFhOV68OIwyNBQ";
var VAPID_PUBLIC_KEY = "BBCVMr_Y4R-XzRca_vn4i8zVYMz7cSe2fgBbVlTdCXwW4ooetiyN_slc83y5rOFgY4gsj_VuqISd-IdlbBFO4-Q";
var SITE = "https://www.espacio3dgt.com";

function db(path, token, opts){
  opts = opts || {};
  return fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: Object.assign({
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
}

module.exports = async function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  if(req.method !== 'POST') return res.status(405).json({error: 'method'});
  if(!process.env.VAPID_PRIVATE_KEY) return res.status(500).json({error: 'missing_vapid_key'});

  var token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if(!token) return res.status(401).json({error: 'login'});

  var b = req.body || {};
  if(typeof b === 'string'){ try { b = JSON.parse(b); } catch(e){ b = {}; } }
  var slug = String(b.slug || '');
  var title = String(b.title || '').slice(0, 80).trim();
  var body = String(b.body || '').slice(0, 180).trim();
  var url = String(b.url || '/' + slug);
  if(!/^[a-z0-9-]{1,60}$/.test(slug) || !title) return res.status(400).json({error: 'datos'});
  if(url.charAt(0) !== '/') url = '/' + slug;   // only links inside this site

  // The admin's own token: RLS returns rows only if this user is an administrator.
  var r = await db('push_subscriptions?select=id,endpoint,p256dh,auth&client_slug=eq.' + slug, token);
  if(r.status === 401) return res.status(401).json({error: 'login'});
  var subs = await r.json();
  if(!Array.isArray(subs)) return res.status(403).json({error: 'admin'});

  webpush.setVapidDetails(SITE, VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  var payload = JSON.stringify({ title: title, body: body, url: url, icon: '/demo-la-posta/app/icon-192.png' });

  var sent = 0, failed = 0, gone = [];
  await Promise.all(subs.map(function(s){
    return webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 })
      .then(function(){ sent++; })
      .catch(function(err){
        failed++;
        if(err && (err.statusCode === 404 || err.statusCode === 410)) gone.push(s.id);   // phone unsubscribed or app removed
      });
  }));

  if(gone.length) await db('push_subscriptions?id=in.(' + gone.join(',') + ')', token, { method: 'DELETE' });
  await db('push_messages', token, { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: { client_slug: slug, title: title, body: body, url: url, sent: sent, failed: failed } });

  return res.status(200).json({ ok: true, total: subs.length, sent: sent, failed: failed, removed: gone.length });
};
