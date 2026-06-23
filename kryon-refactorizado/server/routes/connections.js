/**
 * routes/connections.js — Verifica en vivo una clave de integración pegada
 * por el usuario en el panel (Conexiones). La clave llega en el body solo
 * para esta comprobación puntual contra el servicio externo; el backend
 * no la persiste en ningún sitio.
 *
 * Nota de honestidad: solo Resend y Anthropic se verifican aquí porque sus
 * APIs bloquean llamadas directas desde el navegador (CORS). Supabase se
 * verifica directamente desde el frontend (su API REST sí permite CORS).
 * El resto de integraciones (Stripe, Meta, Google Ads, TikTok, LinkedIn, X,
 * GA4) todavía no tienen un endpoint de verificación real implementado.
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

    return res.status(400).json({ ok: false, error: 'Esta integración todavía no tiene verificación en vivo en el backend' });
  } catch {
    return res.status(502).json({ ok: false, error: 'No se pudo contactar el servicio externo' });
  }
});

module.exports = router;
