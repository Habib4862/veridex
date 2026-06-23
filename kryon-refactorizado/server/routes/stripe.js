/**
 * routes/stripe.js — Crea un enlace de pago real (Stripe Checkout) para que
 * el cliente pague el presupuesto, y permite comprobar si ya lo completó.
 * La clave de Stripe llega en el body (la misma que el usuario pegó en
 * Conexiones); el backend no la persiste en ningún sitio.
 */
const express = require('express');
const router = express.Router();

router.post('/create-payment-link', async (req, res) => {
  const { key, amount, clientName, successUrl, cancelUrl } = req.body || {};
  if (!key || !amount) return res.status(400).json({ ok: false, error: 'Falta key o amount' });

  try {
    const body = new URLSearchParams({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
      'line_items[0][price_data][product_data][name]': `Servicio para ${clientName || 'cliente'}`,
      success_url: successUrl || 'https://checkout.stripe.com/success',
      cancel_url: cancelUrl || 'https://checkout.stripe.com/cancel'
    });
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await r.json();
    if (!r.ok) return res.json({ ok: false, error: data?.error?.message || `Stripe respondió ${r.status}` });
    return res.json({ ok: true, url: data.url, sessionId: data.id });
  } catch {
    return res.status(502).json({ ok: false, error: 'No se pudo contactar con Stripe' });
  }
});

router.post('/check-payment', async (req, res) => {
  const { key, sessionId } = req.body || {};
  if (!key || !sessionId) return res.status(400).json({ ok: false, error: 'Falta key o sessionId' });

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${key}` }
    });
    const data = await r.json();
    if (!r.ok) return res.json({ ok: false, error: data?.error?.message || `Stripe respondió ${r.status}` });
    return res.json({ ok: true, paid: data.payment_status === 'paid', status: data.payment_status });
  } catch {
    return res.status(502).json({ ok: false, error: 'No se pudo contactar con Stripe' });
  }
});

module.exports = router;
