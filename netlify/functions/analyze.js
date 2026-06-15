exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    return respond(400, { error: 'JSON invalido en el body' });
  }

  const { text, lang, system } = body;

  if (!text || text.length < 10) return respond(400, { error: 'Texto demasiado corto' });
  if (!lang)   return respond(400, { error: 'Falta el idioma (lang)' });
  if (!system) return respond(400, { error: 'Falta el system prompt' });
  if (!process.env.ANTHROPIC_API_KEY) return respond(500, { error: 'API key no configurada en Netlify' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: system.substring(0, 2000),
        messages: [{
          role: 'user',
          content: 'Analiza este contrato en ' + lang + '. Responde SOLO con un objeto JSON valido, sin markdown, sin texto extra, sin explicaciones.\n\nContrato:\n' + text.substring(0, 6000)
        }]
      })
    });

    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = 'Error Anthropic (' + resp.status + ')';
      try { errMsg = JSON.parse(errText).error.message || errMsg; } catch(_) {}
      return respond(resp.status >= 500 ? 502 : 400, { error: errMsg });
    }

    const apiData = await resp.json();
    const raw = (apiData.content && apiData.content[0] && apiData.content[0].text) ? apiData.content[0].text.trim() : '';

    if (!raw) return respond(502, { error: 'Respuesta vacia de la IA' });

    const result = parseJSON(raw);
    return respond(200, result);

  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return respond(504, { error: 'Tiempo agotado (8.5s). Pega menos texto del contrato.' });
    }
    return respond(500, { error: e.message || 'Error interno del servidor' });
  }
};

function parseJSON(raw) {
  // Intento 1: parse directo
  try { return JSON.parse(raw); } catch (_) {}

  // Intento 2: extraer primer objeto JSON balanceado
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

  // Intento 3: regex
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (_) {}

  // Fallback: devolver objeto de error informativo
  return {
    risk_level: 'MODERADO',
    risk_score: 50,
    summary: 'No se pudo parsear el analisis. Intenta con menos texto.',
    risks: [{
      title: 'Analisis incompleto',
      description: 'La IA no pudo generar un analisis valido. Reduce el texto del contrato.',
      law_ref: '',
      severity: 'WARNING',
      action: 'Pega solo las clausulas mas importantes (menos de 2000 caracteres).'
    }],
    positives: [],
    letter: 'No se pudo generar la carta legal. Acorta el texto e intentalo de nuevo.'
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
