exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  try {
    const { text, lang, system } = JSON.parse(event.body || '{}');

    if (!text || text.length < 20) {
      return respond(400, { error: 'Texto demasiado corto' });
    }
    if (!lang || !system || system.length < 50) {
      return respond(400, { error: 'Parámetros inválidos' });
    }

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
          content: `Analiza este contrato en ${lang}. IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin markdown. Sé conciso en los textos para que el JSON no se trunque.\n\nContrato:\n${text.substring(0, 8000)}`
        }]
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`Error Anthropic (${resp.status}): ${err.error?.message || 'Error desconocido'}`);
    }

    const data = await resp.json();
    const raw = (data.content?.[0]?.text || '').trim();
    const result = parseJSON(raw);

    return respond(200, result);
  } catch (e) {
    console.error('analyze error:', e);
    return respond(500, { error: e.message || 'Error interno del servidor' });
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
    risk_level: 'MODERADO',
    risk_score: 50,
    summary: 'El análisis fue interrumpido por la longitud del contrato. Pega solo las cláusulas más importantes.',
    risks: [{
      title: 'Análisis incompleto',
      description: 'El texto es demasiado largo. Pega las cláusulas principales.',
      law_ref: '',
      severity: 'WARNING',
      action: 'Acorta el texto e inténtalo de nuevo.'
    }],
    positives: [],
    letter: 'No se pudo generar la carta legal. Acorta el texto e inténtalo de nuevo.'
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
