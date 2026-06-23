/**
 * routes/push.js — Web Push: expone la clave pública VAPID, guarda
 * suscripciones del navegador y permite enviar notificaciones.
 * Genera tu propio par de claves con `npx web-push generate-vapid-keys`.
 */
const express = require('express');
const webpush = require('web-push');
const db = require('../lib/supabase');
const router = express.Router();

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:admin@axiomcore.app', VAPID_PUBLIC, VAPID_PRIVATE);
}

router.get('/vapid-public-key', (req, res) => res.json({ publicKey: VAPID_PUBLIC }));

router.post('/subscribe', async (req, res) => {
  try {
    if (db.isConfigured()) await db.insert('push_subscriptions', { subscription: req.body, created_at: new Date().toISOString() });
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/send', async (req, res) => {
  const { subscription, title, body } = req.body || {};
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(503).json({ error: 'VAPID no configurado en el servidor' });
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
