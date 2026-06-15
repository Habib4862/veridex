const express  = require('express');
const cors     = require('cors');
const app      = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── HEALTH CHECK ────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'VERIDEX API OK', model: 'claude-sonnet-4-6' }));

// ─── ANALYZE ─────────────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  const { text, lang, system } = req.body || {};

  if (!text || text.length < 10) return res.status(400).json({ error: 'Texto demasiado corto' });
  if (!lang)   return res.status(400).json({ error: 'Falta el idioma (lang)' });
  if (!system) return res.status(400).json({ error: 'Falta el system prompt' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: system,
        messages: [{
          role: 'user',
          content: 'Analiza este contrato en ' + lang + '. Responde SOLO con un objeto JSON valido, sin markdown, sin texto extra.\n\nContrato:\n' + text
        }]
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      return res.status(502).json({ error: (errData.error && errData.error.message) || 'Error Anthropic ' + resp.status });
    }

    const apiData = await resp.json();
    const raw = (apiData.content && apiData.content[0] && apiData.content[0].text)
      ? apiData.content[0].text.trim() : '';

    if (!raw) return res.status(502).json({ error: 'Respuesta vacia de la IA' });

    return res.json(parseJSON(raw));

  } catch (e) {
    console.error('analyze error:', e.message);
    return res.status(500).json({ error: e.message || 'Error interno' });
  }
});

// ─── VERIFY ADMIN ────────────────────────────────────────────
app.post('/api/verify-admin', (req, res) => {
  const { code } = req.body || {};
  const valid = typeof code === 'string' && code.length > 0 && code === process.env.ADMIN_CODE;
  res.json({ valid });
});

// ─── CREATE PAYMENT ──────────────────────────────────────────
app.post('/api/create-payment', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'STRIPE_SECRET_KEY no configurada' });
  try {
    const resp = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        amount: '2500',
        currency: 'eur',
        'automatic_payment_methods[enabled]': 'true'
      }).toString()
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error((data.error && data.error.message) || 'Error Stripe');
    res.json({ client_secret: data.client_secret });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error interno' });
  }
});

// ─── FEEDBACK (guarda en memoria — opcional DB después) ───────
const feedbacks = [];
app.post('/api/feedback', (req, res) => {
  const fb = { ...req.body, received_at: new Date().toISOString() };
  feedbacks.push(fb);
  console.log('FEEDBACK:', JSON.stringify(fb));
  res.json({ ok: true });
});

app.get('/api/feedback', (req, res) => {
  res.json({ total: feedbacks.length, feedbacks });
});

// ─── PARSE JSON ROBUSTO ───────────────────────────────────────
function parseJSON(raw) {
  try { return JSON.parse(raw); } catch (_) {}
  try {
    const s = raw.indexOf('{');
    if (s !== -1) {
      let depth = 0, end = -1;
      for (let i = s; i < raw.length; i++) {
        if (raw[i] === '{') depth++;
        else if (raw[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end !== -1) return JSON.parse(raw.substring(s, end + 1));
    }
  } catch (_) {}
  try { const m = raw.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch (_) {}
  return {
    risk_level: 'MODERADO', risk_score: 50,
    summary: 'No se pudo parsear el analisis. Intentalo de nuevo.',
    risks: [{ title: 'Error de analisis', description: 'Hubo un problema procesando la respuesta.', law_ref: '', severity: 'WARNING', action: 'Intentalo de nuevo.' }],
    positives: [],
    letter: 'No se pudo generar la carta. Intentalo de nuevo.'
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('VERIDEX API corriendo en puerto ' + PORT));
