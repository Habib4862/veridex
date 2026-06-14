const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  let jobId;
  try {
    const { text, lang, system, jobId: jid } = JSON.parse(event.body || '{}');
    jobId = jid;

    if (!jobId || !text || text.length < 20 || !lang || !system) return;

    const store = getStore('jobs');

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
        system,
        messages: [{
          role: 'user',
          content: `Analiza este contrato en ${lang}. IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin markdown. Sé conciso para que el JSON no se trunque.\n\nContrato:\n${text.substring(0, 8000)}`
        }]
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      await store.setJSON(jobId, {
        status: 'error',
        error: `Error Anthropic (${resp.status}): ${err.error?.message || 'Error desconocido'}`
      });
      return;
    }

    const data = await resp.json();
    const raw = (data.content?.[0]?.text || '').trim();
    const result = parseJSON(raw);

    await store.setJSON(jobId, { status: 'done', result });

  } catch (e) {
    console.error('analyze-background error:', e);
    if (jobId) {
      try {
        const store = getStore('jobs');
        await store.setJSON(jobId, { status: 'error', error: e.message || 'Error interno' });
      } catch (_) {}
    }
  }
};

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
    summary: 'Análisis interrumpido por longitud del contrato.',
    risks: [{ title: 'Análisis incompleto', description: 'Pega las cláusulas principales.', law_ref: '', severity: 'WARNING', action: 'Acorta el texto.' }],
    positives: [],
    letter: 'No se pudo generar la carta legal. Acorta el texto.'
  };
}
