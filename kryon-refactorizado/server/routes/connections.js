/**
 * routes/connections.js — Verifica en vivo una clave de integración pegada
 * por el usuario en el panel (Conexiones). La clave llega en el body solo
 * para esta comprobación puntual contra el servicio externo; el backend
 * no la persiste en ningún sitio.
 *
 * Nota de honestidad: Resend, Anthropic, Stripe, Meta, TikTok, LinkedIn y X
 * se verifican aquí porque sus APIs bloquean llamadas directas desde el
 * navegador (CORS). Supabase se verifica directamente desde el frontend
 * (su API REST sí permite CORS). Google Ads y GA4 de Google usan OAuth2
 * con varias credenciales en vez de una sola clave, así que no tienen
 * verificación en vivo implementada aquí.
 */
const express = require('express');
const router = express.Router();

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

    return res.status(400).json({ ok: false, error: 'Esta integración todavía no tiene verificación en vivo en el backend' });
  } catch {
    return res.status(502).json({ ok: false, error: 'No se pudo contactar el servicio externo' });
  }
});

module.exports = router;
