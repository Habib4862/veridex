/**
 * routes/resend.js — Envía un email real a través de la API de Resend
 * (primer contacto a un negocio detectado). La clave llega en el body
 * solo para esta llamada puntual; el backend no la persiste en ningún sitio.
 */
const express = require('express');
const router = express.Router();

router.post('/send', async (req, res) => {
  const { key, from, to, subject, html } = req.body || {};
  if (!key || !from || !to || !subject || !html) {
    return res.status(400).json({ ok: false, error: 'Falta key, from, to, subject o html' });
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.json({ ok: false, error: data?.message || `Resend respondió ${r.status}` });
    return res.json({ ok: true, id: data.id });
  } catch {
    return res.status(502).json({ ok: false, error: 'No se pudo contactar con Resend' });
  }
});

module.exports = router;
