exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  const code = event.headers['x-admin-code'] || event.headers['X-Admin-Code'];
  if (!code || code !== process.env.ADMIN_CODE) {
    return respond(401, { error: 'No autorizado' });
  }

  const systemStatus = {
    anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    adminConfigured: !!process.env.ADMIN_CODE,
    timestamp: new Date().toISOString()
  };

  let stripe = null;
  let stripeError = null;

  if (systemStatus.stripeConfigured) {
    try {
      stripe = await fetchStripeStats();
    } catch (e) {
      stripeError = e.message || 'Error consultando Stripe';
    }
  }

  return respond(200, { systemStatus, stripe, stripeError });
};

async function fetchStripeStats() {
  const headers = { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` };

  const [balanceResp, chargesResp] = await Promise.all([
    fetch('https://api.stripe.com/v1/balance', { headers }),
    fetch('https://api.stripe.com/v1/charges?limit=10', { headers })
  ]);

  const balanceData = await balanceResp.json();
  const chargesData = await chargesResp.json();

  if (!balanceResp.ok) throw new Error(balanceData.error?.message || 'Error obteniendo balance de Stripe');
  if (!chargesResp.ok) throw new Error(chargesData.error?.message || 'Error obteniendo cargos de Stripe');

  const available = (balanceData.available || []).map(b => ({ amount: b.amount, currency: b.currency }));
  const pending = (balanceData.pending || []).map(b => ({ amount: b.amount, currency: b.currency }));

  const recentCharges = (chargesData.data || []).map(c => ({
    id: c.id,
    amount: c.amount,
    currency: c.currency,
    status: c.status,
    paid: c.paid,
    created: c.created,
    email: c.billing_details?.email || c.receipt_email || null
  }));

  const recentChargesTotal = recentCharges.filter(c => c.paid).reduce((sum, c) => sum + c.amount, 0);

  return { available, pending, recentCharges, recentChargesTotal, recentChargesCount: recentCharges.length };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
