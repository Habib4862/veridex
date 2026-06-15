const express = require('express');
const cors    = require('cors');
const app     = express();

// CORS — acepta peticiones desde cualquier origen
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight OPTIONS global
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));

// Log de todas las peticiones
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} — origin: ${req.headers.origin || 'none'}`);
  next();
});

// HEALTH CHECK
app.get('/', (req, res) => {
  res.json({ status: 'VERIDEX API OK', model: 'claude-sonnet-4-6', port: process.env.PORT || 3000 });
});

// ANALYZE
app.post('/api/analyze', async (req, res) => {
  const { text, lang, system } = req.body || {};
  console.log(`analyze: lang=${lang}, text_len=${text ? text.length : 0}`);

  if (!text || text.length < 10) return res.status(400).json({ error: 'Texto demasiado corto' });
  if (!lang)   return res.status(400).json({ error: 'Falta lang' });
  if (!system) return res.status(400).json({ error: 'Falta system' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });

  try {
    console.log('Llamando a Anthropic...');
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
        messages: [{ role: 'user', content: 'Analiza este contrato en ' + lang + '. Responde SOLO JSON valido, sin markdown.\n\n' + text }]
      })
    });

    console.log('Anthropic status:', resp.status);

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const msg = (errData.error && errData.error.message) || 'Error Anthropic ' + resp.status;
      console.error('Anthropic error:', msg);
      return res.status(502).json({ error: msg });
    }

    const apiData = await resp.json();
    const raw = (apiData.content && apiData.content[0] && apiData.content[0].text)
      ? apiData.content[0].text.trim() : '';

    console.log('Raw length:', raw.length, '| First 100:', raw.substring(0, 100));

    if (!raw) return res.status(502).json({ error: 'Respuesta vacia de Anthropic' });

    return res.json(parseJSON(raw));

  } catch (e) {
    console.error('Error en /api/analyze:', e.message);
    return res.status(500).json({ error: e.message || 'Error interno' });
  }
});

// VERIFY ADMIN
app.post('/api/verify-admin', (req, res) => {
  const { code } = req.body || {};
  res.json({ valid: typeof code === 'string' && code === process.env.ADMIN_CODE });
});

// CREATE PAYMENT
app.post('/api/create-payment', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'STRIPE_SECRET_KEY no configurada' });
  try {
    const r = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'amount=2500&currency=eur&automatic_payment_methods[enabled]=true'
    });
    const data = await r.json();
    if (!r.ok) throw new Error((data.error && data.error.message) || 'Error Stripe');
    res.json({ client_secret: data.client_secret });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function parseJSON(raw) {
  try { return JSON.parse(raw); } catch (_) {}
  try {
    let depth = 0, start = raw.indexOf('{'), end = -1;
    if (start !== -1) {
      for (let i = start; i < raw.length; i++) {
        if (raw[i] === '{') depth++;
        else if (raw[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end !== -1) return JSON.parse(raw.substring(start, end + 1));
    }
  } catch (_) {}
  return { risk_level: 'MODERADO', risk_score: 50, summary: 'Error parseando respuesta.', risks: [], positives: [], letter: '' };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`VERIDEX API corriendo en puerto ${PORT}`));
