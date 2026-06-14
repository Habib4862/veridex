const ALLOWED_TYPES = ['rental','labor','freelance','purchase','mortgage','nda','business','other'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' } };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { contractText, lang, contractType, systemPrompt, paymentMethodId, isFree, adminCode } = body;

    if (!contractText || contractText.length < 20) {
      return respond(400, { error: 'Contrato demasiado corto' });
    }
    if (!ALLOWED_TYPES.includes(contractType)) {
      return respond(400, { error: 'Tipo de contrato no válido' });
    }
    if (!systemPrompt || systemPrompt.length < 50) {
      return respond(400, { error: 'Parámetros inválidos' });
    }

    const isAdmin = adminCode && adminCode === process.env.ADMIN_CODE;

    if (!isFree && !isAdmin) {
      if (!paymentMethodId) {
        return respond(402, { error: 'Pago requerido' });
      }

      const stripeResp = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          amount: '2500',
          currency: 'eur',
          payment_method: paymentMethodId,
          confirm: 'true',
          'automatic_payment_methods[enabled]': 'true',
          'automatic_payment_methods[allow_redirects]': 'never'
        }).toString()
      });

      const paymentData = await stripeResp.json();

      if (!stripeResp.ok || paymentData.status !== 'succeeded') {
        const errMsg = paymentData.error?.message || 'Pago no procesado correctamente';
        return respond(402, { error: errMsg });
      }
    }

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Analiza este contrato en ${lang}. IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin markdown. Sé conciso en los textos para que el JSON no se trunque.\n\nContrato:\n${contractText.substring(0, 8000)}`
        }]
      })
    });

    if (!claudeResp.ok) {
      const err = await claudeResp.json().catch(() => ({}));
      throw new Error(`Error Claude (${claudeResp.status}): ${err.error?.message || 'Error desconocido'}`);
    }

    const claudeData = await claudeResp.json();
    const raw = (claudeData.content?.[0]?.text || '').trim();
    const result = parseJSON(raw);

    return respond(200, result);

  } catch (e) {
    console.error('Function error:', e);
    return respond(500, { error: e.message || 'Error interno del servidor' });
  }
};

function parseJSON(raw) {
  try { return JSON.parse(raw); } catch (_) {}

  try {
    const start = raw.indexOf('{');
    if (start !== -1) {
      let depth = 0, end = -1;
      for (let i = start; i < raw.length; i++) {
        if (raw[i] === '{') depth++;
        else if (raw[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end !== -1) return JSON.parse(raw.substring(start, end + 1));
    }
  } catch (_) {}

  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (_) {}

  return {
    risk_level: 'MODERADO',
    risk_score: 50,
    summary: 'El análisis fue interrumpido por la longitud del contrato. Por favor, pega solo las cláusulas más importantes (máx. 3000 caracteres) para obtener un análisis completo.',
    risks: [{
      title: 'Análisis incompleto',
      description: 'El contrato es demasiado largo para analizarlo de una vez. Pega las cláusulas principales o el texto más relevante.',
      law_ref: '',
      severity: 'WARNING',
      action: 'Acorta el texto del contrato y vuelve a intentarlo.'
    }],
    positives: [],
    letter: 'No se pudo generar la carta legal por la longitud del contrato. Acorta el texto e inténtalo de nuevo.'
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
