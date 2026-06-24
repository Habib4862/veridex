/**
 * routes/claude.js — Proxy hacia la API de Anthropic. La clave llega en el
 * body en cada llamada (la misma que el usuario pegó en Conexiones, igual
 * que Resend/Stripe/Google Places); el backend no la persiste en ningún
 * sitio. Si no hay clave, no se inventa contenido: se responde sin "html"
 * real para que el frontend use su propia plantilla de marcador de posición.
 *
 * Si Anthropic corta la respuesta por límite de tokens (stop_reason
 * "max_tokens"), no se devuelve HTML a medias como si fuera el resultado
 * final: se le pide a Claude que continúe exactamente donde lo dejó y se
 * concatena, hasta MAX_CONTINUATIONS veces, para no entregar nunca una
 * demo con el HTML roto a mitad.
 */
const express = require('express');
const router = express.Router();

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;
const MAX_CONTINUATIONS = 2;

async function callAnthropic(key, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Anthropic respondió ${r.status}`);
  return data;
}

router.post('/generate', async (req, res) => {
  const { prompt, key } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });
  if (!key) return res.status(400).json({ error: 'Falta tu clave de Anthropic (Conexiones)' });

  const messages = [{ role: 'user', content: `${prompt}\nDevuelve únicamente HTML válido, sin explicaciones.` }];
  try {
    let data = await callAnthropic(key, messages);
    let html = data?.content?.[0]?.text || '';
    if (!html) return res.json({ error: 'Anthropic no devolvió contenido' });

    let continuations = 0;
    while (data.stop_reason === 'max_tokens' && continuations < MAX_CONTINUATIONS) {
      messages.push({ role: 'assistant', content: html });
      messages.push({ role: 'user', content: 'Continúa exactamente desde donde lo dejaste, sin repetir nada ya escrito, hasta cerrar el HTML con </body></html>.' });
      data = await callAnthropic(key, messages);
      html += data?.content?.[0]?.text || '';
      continuations++;
    }
    res.json({ html });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
