exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method Not Allowed' });
  }
  try {
    const { text, lang, system } = JSON.parse(event.body || '{}');
    if (!text || text.length < 10) return respond(400, { error: 'Texto demasiado corto' });
    if (!lang || !system)          return respond(400, { error: 'Parametros invalidos' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8800);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: system.substring(0, 1200),
        messages: [{ role: 'user', content: 'Analiza este contrato en ' + lang + '. Responde SOLO JSON valido sin markdown.\n\nContrato:\n' + text.substring(0, 4000) }]
      })
    });

    clearTimeout(timer);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error('Error Anthropic (' + resp.status + '): ' + ((err.error || {}).message || 'Error'));
    }
    const data = await resp.json();
    const raw = ((data.content || [])[0] || {}).text || '';
    return respond(200, parseJSON(raw.trim()));
  } catch (e) {
    if (e.name === 'AbortError') return respond(504, { error: 'Tiempo agotado. Pega menos texto.' });
    return respond(500, { error: e.message || 'Error interno' });
  }
};

function parseJSON(raw) {
  try { return JSON.parse(raw); } catch (_) {}
  try {
    const s = raw.indexOf('{');
    if (s !== -1) {
      let d = 0, e = -1;
      for (let i = s; i < raw.length; i++) {
        if (raw[i] === '{') d++;
        else if (raw[i] === '}') { d--; if (d === 0) { e = i; break; } }
      }
      if (e !== -1) return JSON.parse(raw.substring(s, e + 1));
    }
  } catch (_) {}
  try { const m = raw.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch (_) {}
  return { risk_level:'MODERADO', risk_score:50, summary:'Pega menos texto del contrato.', risks:[{title:'Texto largo', description:'Acorta el contrato.', law_ref:'', severity:'WARNING', action:'Menos texto.'}], positives:[], letter:'Acorta el texto.' };
}

function respond(statusCode, body) {
  return { statusCode, headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify(body) };
}
