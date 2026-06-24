/**
 * routes/connections.js — Verifica en vivo una clave de integración pegada
 * por el usuario en el panel (Conexiones). La clave llega en el body solo
 * para esta comprobación puntual contra el servicio externo; el backend
 * no la persiste en ningún sitio.
 *
 * Nota de honestidad: Resend, Anthropic, Stripe, Meta, TikTok, LinkedIn, X,
 * GA4 y Google Places se verifican aquí porque sus APIs bloquean llamadas
 * directas desde el navegador (CORS), o (en el caso de GA4) requieren un
 * intercambio OAuth2 de cuenta de servicio que no puede hacerse desde el
 * navegador. Supabase se verifica directamente desde el frontend (su API
 * REST sí permite CORS). Google Ads usa OAuth2 con varias credenciales en
 * vez de una sola clave, así que no tiene verificación en vivo implementada
 * aquí.
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Intercambia las credenciales de una cuenta de servicio de Google por un access token,
 * firmando un JWT con la clave privada (flujo OAuth2 server-to-server, sin navegador). */
async function getGoogleAccessToken(clientEmail, privateKey, scope) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const claims = base64url(Buffer.from(JSON.stringify({
    iss: clientEmail, scope, aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now
  })));
  const signingInput = `${header}.${claims}`;
  const signature = base64url(crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey));
  const jwt = `${signingInput}.${signature}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description || 'No se pudo autenticar con Google (revisa client_email y private_key)');
  return data.access_token;
}

router.post('/test', async (req, res) => {
  const { service, key } = req.body || {};
  if (!service || !key) return res.status(400).json({ ok: false, error: 'Falta service o key' });

  try {
    if (service === 'resend') {
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` } });
      if (r.status === 401 || r.status === 403) return res.json({ ok: false, error: 'Clave inválida o sin permisos' });
      if (!r.ok) return res.json({ ok: false, error: `Resend respondió ${r.status}` });
      return res.json({ ok: true, detail: 'acceso confirmado a la API de Resend' });
    }

    if (service === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } });
      if (r.status === 401) return res.json({ ok: false, error: 'Clave inválida' });
      if (!r.ok) return res.json({ ok: false, error: `Anthropic respondió ${r.status}` });
      return res.json({ ok: true, detail: 'acceso confirmado a la API de Anthropic' });
    }

    if (service === 'stripe') {
      const r = await fetch('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${key}` } });
      if (r.status === 401) return res.json({ ok: false, error: 'Clave inválida' });
      if (!r.ok) return res.json({ ok: false, error: `Stripe respondió ${r.status}` });
      return res.json({ ok: true, detail: 'acceso confirmado a la API de Stripe' });
    }

    if (service === 'meta') {
      const r = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(key)}`);
      if (r.status === 401 || r.status === 400) return res.json({ ok: false, error: 'Clave inválida o expirada' });
      if (!r.ok) return res.json({ ok: false, error: `Meta respondió ${r.status}` });
      return res.json({ ok: true, detail: 'acceso confirmado a la API de Meta' });
    }

    if (service === 'tiktok') {
      const r = await fetch('https://business-api.tiktok.com/open_api/v1.3/user/info/', { headers: { 'Access-Token': key } });
      if (r.status === 401) return res.json({ ok: false, error: 'Clave inválida' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || (data.code && data.code !== 0)) return res.json({ ok: false, error: data.message || `TikTok respondió ${r.status}` });
      return res.json({ ok: true, detail: 'acceso confirmado a la API de TikTok' });
    }

    if (service === 'linkedin') {
      const r = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${key}` } });
      if (r.status === 401) return res.json({ ok: false, error: 'Clave inválida o expirada' });
      if (!r.ok) return res.json({ ok: false, error: `LinkedIn respondió ${r.status}` });
      return res.json({ ok: true, detail: 'acceso confirmado a la API de LinkedIn' });
    }

    if (service === 'x') {
      const r = await fetch('https://api.twitter.com/2/users/by/username/twitter', { headers: { Authorization: `Bearer ${key}` } });
      if (r.status === 401) return res.json({ ok: false, error: 'Clave inválida' });
      if (!r.ok) return res.json({ ok: false, error: `X respondió ${r.status}` });
      return res.json({ ok: true, detail: 'acceso confirmado a la API de X' });
    }

    if (service === 'google_places') {
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id' },
        body: JSON.stringify({ textQuery: 'negocio en Madrid', languageCode: 'es' })
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403 || data.error?.status === 'PERMISSION_DENIED') {
        return res.json({ ok: false, error: 'Clave inválida o sin permisos (activa "Places API (New)" en Google Cloud Console)' });
      }
      if (!r.ok) return res.json({ ok: false, error: data.error?.message || `Google Places respondió ${r.status}` });
      return res.json({ ok: true, detail: 'acceso confirmado a la API de Google Places' });
    }

    if (service === 'ga4') {
      let creds;
      try { creds = JSON.parse(key); } catch { return res.json({ ok: false, error: 'El JSON de la cuenta de servicio no es válido' }); }
      const { client_email: clientEmail, private_key: privateKey } = creds;
      const propertyId = String(creds.property_id || '').trim().replace(/^properties\//, '');
      if (!clientEmail || !privateKey || !propertyId) {
        return res.json({ ok: false, error: 'Falta client_email, private_key o property_id en el JSON' });
      }
      let accessToken;
      try {
        accessToken = await getGoogleAccessToken(clientEmail, privateKey, 'https://www.googleapis.com/auth/analytics.readonly');
      } catch (e) {
        return res.json({ ok: false, error: e.message });
      }
      let r;
      try {
        r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ dateRanges: [{ startDate: 'today', endDate: 'today' }], metrics: [{ name: 'activeUsers' }] })
        });
      } catch (e) {
        return res.json({ ok: false, error: `No se pudo contactar la API de Google Analytics: ${e.message}` });
      }
      if (r.status === 403) return res.json({ ok: false, error: 'La cuenta de servicio no tiene acceso a esta propiedad (añádela como Lector en GA4 → Administrar → Acceso a la propiedad)' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        return res.json({ ok: false, error: d.error?.message || `GA4 respondió ${r.status}` });
      }
      return res.json({ ok: true, detail: 'acceso confirmado a la API de Google Analytics 4' });
    }

    return res.status(400).json({ ok: false, error: 'Esta integración todavía no tiene verificación en vivo en el backend' });
  } catch {
    return res.status(502).json({ ok: false, error: 'No se pudo contactar el servicio externo' });
  }
});

module.exports = router;
