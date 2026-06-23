/**
 * rateLimit.js — Limitador básico en memoria (ventana fija por IP).
 * Sin dependencias externas; suficiente para un panel interno de un solo
 * proceso. Si se despliega con múltiples instancias, sustituir por Redis.
 */
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 60;
const buckets = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = buckets.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }
  bucket.count++;
  buckets.set(ip, bucket);
  if (bucket.count > MAX_REQUESTS) {
    return res.status(429).json({ error: 'Demasiadas solicitudes, intenta más tarde' });
  }
  next();
}

module.exports = rateLimit;
