/* ============================================================
   Vercel Serverless Function — serves each client's contact card
   as a real .vcf file with the correct Content-Type, instead of a
   "data:" URI link. Phones (iOS Safari and Android Chrome both)
   are unreliable at turning a data:text/vcard link into an
   "Add to Contacts" prompt — a real file response from the server
   is the compatible way to do this on both platforms.
   ============================================================ */

var SUPABASE_URL = "https://oifgcicvnrodipjfjkso.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZmdjaWN2bnJvZGlwamZqa3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTQ3OTksImV4cCI6MjEwNTg3MDc5OX0.rkGZ2UQhgqcFns4KpHocYXFbh5o5cgFhOV68OIwyNBQ";

function slugify(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48) || 'contacto';
}

function escapeVcard(s){
  return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}

module.exports = async function handler(req, res){
  var slug = req.query.slug;
  if(!slug){
    res.status(404).send('Not found');
    return;
  }
  try{
    var apiUrl = SUPABASE_URL+'/rest/v1/clients?slug=eq.'+encodeURIComponent(slug)+'&select=*';
    var r = await fetch(apiUrl, { headers: { apikey: SUPABASE_ANON_KEY } });
    var data = await r.json();
    var client = data && data[0];
    if(!client || !client.phone || !client.save_contact_enabled){
      res.status(404).send('Not found');
      return;
    }
    var proto = (req.headers['x-forwarded-proto'] || 'https');
    var pageUrl = proto+'://'+req.headers.host+'/'+encodeURIComponent(slug);
    var lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:'+escapeVcard(client.contact_name || client.name),
      'ORG:'+escapeVcard(client.name),
      'TEL;TYPE=CELL:'+escapeVcard(client.phone),
      'URL:'+pageUrl,
      client.tagline ? 'NOTE:'+escapeVcard(client.tagline) : '',
      'END:VCARD'
    ].filter(Boolean).join('\r\n');
    var filename = slugify(client.contact_name || client.name)+'.vcf';
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="'+filename+'"');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).send(lines);
  }catch(e){
    console.error(e);
    res.status(500).send('Error del servidor');
  }
};
