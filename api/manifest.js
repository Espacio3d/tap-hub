/* ============================================================
   Vercel Serverless Function — web app manifest of a client page,
   so visitors can save /<slug> to their home screen with the
   client's own name and logo. Only for clients with
   "Acceso directo" (app_enabled) or "Notificaciones de ofertas" (push_enabled) on.
   Route: /api/manifest?slug=<slug>
   ============================================================ */
var SUPABASE_URL = "https://oifgcicvnrodipjfjkso.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZmdjaWN2bnJvZGlwamZqa3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTQ3OTksImV4cCI6MjEwNTg3MDc5OX0.rkGZ2UQhgqcFns4KpHocYXFbh5o5cgFhOV68OIwyNBQ";

module.exports = async function handler(req, res){
  var slug = String(req.query.slug || '');
  if(!/^[a-z0-9-]{1,60}$/.test(slug)) return res.status(404).json({});
  var r = await fetch(SUPABASE_URL + '/rest/v1/clients?slug=eq.' + slug + '&select=name,accent,logo,app_tabs,app_enabled,push_enabled,push_icon_192,push_icon_512,active',
    { headers: { apikey: SUPABASE_ANON_KEY } });
  var c = (await r.json().catch(function(){ return []; }))[0];
  if(!c || (c.app_enabled !== true && c.push_enabled !== true) || c.active === false) return res.status(404).json({});
  var logo = /^https?:\/\//.test(c.logo || '') ? c.logo : null;
  var i192 = c.push_icon_192 || logo, i512 = c.push_icon_512 || logo;
  // Opens on the first page of "La app incluye" ("La app abre en" in the panel).
  var START = { home: '', menu: '/menu', recetas: '/recetas', sello: '/sello' };
  var start = START[String(c.app_tabs || 'home').split(',')[0]] || '';
  var icons = [];
  if(i192) icons.push({ src: i192, sizes: '192x192', type: 'image/png' });
  if(i512) icons.push({ src: i512, sizes: '512x512', type: 'image/png' }, { src: i512, sizes: '512x512', type: 'image/png', purpose: 'maskable' });
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(JSON.stringify({
    name: c.name,
    short_name: String(c.name).slice(0, 12),
    id: '/' + slug,
    start_url: '/' + slug + start + '?app=1',
    scope: '/' + slug,
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: /^#[0-9a-fA-F]{6}$/.test(c.accent || '') ? c.accent : '#0E7A5F',
    lang: 'es',
    icons: icons
  }));
};
