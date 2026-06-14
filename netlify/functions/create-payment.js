exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  try {
    const resp = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        amount: '2500',
        currency: 'eur',
        'automatic_payment_methods[enabled]': 'true'
      }).toString()
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error?.message || 'Error creando el pago');
    }

    return respond(200, { client_secret: data.client_secret });
  } catch (e) {
    console.error('create-payment error:', e);
    return respond(500, { error: e.message || 'Error interno del servidor' });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
