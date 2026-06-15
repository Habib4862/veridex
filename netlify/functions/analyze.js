exports.handler = async (event) => {
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
  try { body = JSON.parse(event.body || '{}'); }
  catch(e) { return respond(400, { error: 'JSON invalido' }); }

  const { text, lang, system } = body;

  if (!text || text.length < 10) return respond(400, { error: 'Texto demasiado corto' });
  if (!lang)   return respond(400, { error: 'Falta el idioma' });
  if (!system) return respond(400, { error: 'Falta el system prompt' });
  if (!process.env.ANTHROPIC_API_KEY) return respond(500, { error: 'ANTHROPIC_API_KEY no configurada en Netlify' });

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
        max_tokens: 4000,
        system: system.substring(0, 2000),
        messages: [{
          role: 'user',
          content: 'Analiza este contrato en ' + lang + '. Responde SOLO con un objeto JSON valido, sin markdown, sin texto extra.\n\nContrato:\n' + text.substring(0, 6000)
        }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = 'Error Anthropic (' + resp.status + ')';
      try { errMsg = JSON.parse(errText).error.message || errMsg; } catch(_) {}
      return respond(resp.status >= 500 ? 502 : 400, { error: errMsg });
    }

    const apiData = await resp.json();
    const raw = (apiData.content && apiData.content[0] && apiData.content[0].text)
      ? apiData.content[0].text.trim() : '';

    if (!raw) return respond(502, { error: 'Respuesta vacia de la IA' });

    return respond(200, parseJSON(raw));

  } catch (e) {
    console.error('analyze error:', e.name, e.message);
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
    risk_level: 'MODERADO', risk_score: 50,
    summary: 'No se pudo completar el analisis. Intenta con menos texto.',
    risks: [{ title: 'Analisis incompleto', description: 'Reduce el texto del contrato.', law_ref: '', severity: 'WARNING', action: 'Pega menos de 2000 caracteres.' }],
    positives: [],
    letter: 'No se pudo generar la carta. Acorta el texto.'
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  };
}
