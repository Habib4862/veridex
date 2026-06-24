/**
 * routes/claude.js — Proxy hacia la API de Anthropic. La clave llega en el
 * body en cada llamada (la misma que el usuario pegó en Conexiones, igual
 * que Resend/Stripe/Google Places); el backend no la persiste en ningún
 * sitio. Si no hay clave, no se inventa contenido: se responde sin "html"
 * real para que el frontend use su propia plantilla de marcador de posición.
 */
const express = require('express');
const router = express.Router();

router.post('/generate', async (req, res) => {
  const { prompt, key } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });
  if (!key) return res.status(400).json({ error: 'Falta tu clave de Anthropic (Conexiones)' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: `${prompt}\nDevuelve únicamente HTML válido, sin explicaciones.` }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.json({ error: data?.error?.message || `Anthropic respondió ${r.status}` });
    const html = data?.content?.[0]?.text;
    if (!html) return res.json({ error: 'Anthropic no devolvió contenido' });
    res.json({ html });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
