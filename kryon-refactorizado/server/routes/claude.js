/**
 * routes/claude.js — Proxy hacia la API de Anthropic. La API key vive solo
 * en el servidor (ANTHROPIC_API_KEY); el frontend nunca la ve. Si no hay
 * key configurada, responde con una plantilla simple para no romper el
 * Creador de demos del frontend.
 */
const express = require('express');
const router = express.Router();

router.post('/generate', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.json({ html: `<h1>${String(prompt).slice(0, 60)}</h1>` });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: `${prompt}\nDevuelve únicamente HTML válido, sin explicaciones.` }]
      })
    });
    const data = await r.json();
    const html = data?.content?.[0]?.text || `<h1>${String(prompt).slice(0, 60)}</h1>`;
    res.json({ html });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
