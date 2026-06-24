/**
 * routes/emails.js — Busca un email de contacto real para un negocio a
 * partir de su sitio web: primero intenta extraerlo de la propia web
 * (gratis, sin clave), y si no aparece, usa Hunter.io como respaldo si el
 * usuario configuró su clave. Ninguna clave se persiste en ningún sitio.
 */
const express = require('express');
const router = express.Router();

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IGNORED_DOMAINS = ['sentry.io', 'wixpress.com', 'example.com', 'godaddy.com', 'cloudflare.com', 'wordpress.com', 'gravatar.com', 'schema.org'];

function pickBestEmail(emails, domain) {
  const clean = [...new Set(emails)].filter(e => !IGNORED_DOMAINS.some(d => e.toLowerCase().endsWith('@' + d)));
  if (!clean.length) return null;
  const sameDomain = domain ? clean.find(e => e.toLowerCase().endsWith('@' + domain.toLowerCase())) : null;
  return sameDomain || clean[0];
}

async function scrapeEmailFromSite(website) {
  let url;
  try { url = new URL(website); } catch { return null; }
  const domain = url.hostname.replace(/^www\./, '');
  const pagesToTry = [url.href, `${url.origin}/contacto`, `${url.origin}/contact`];

  for (const pageUrl of pagesToTry) {
    try {
      const r = await fetch(pageUrl, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const html = await r.text();
      const found = html.match(EMAIL_RE);
      if (found?.length) {
        const best = pickBestEmail(found, domain);
        if (best) return best;
      }
    } catch { /* probamos la siguiente página */ }
  }
  return null;
}

async function hunterEmail(website, hunterKey) {
  let domain;
  try { domain = new URL(website).hostname.replace(/^www\./, ''); } catch { return null; }
  try {
    const r = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(hunterKey)}&limit=1`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    return data.data?.emails?.[0]?.value || null;
  } catch {
    return null;
  }
}

/** Respaldo para negocios sin web: Hunter.io permite buscar por nombre de
 * empresa en vez de dominio cuando no hay sitio que rastrear. */
async function hunterEmailByCompany(businessName, hunterKey) {
  try {
    const r = await fetch(`https://api.hunter.io/v2/domain-search?company=${encodeURIComponent(businessName)}&api_key=${encodeURIComponent(hunterKey)}&limit=1`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    return data.data?.emails?.[0]?.value || null;
  } catch {
    return null;
  }
}

router.post('/find', async (req, res) => {
  const { website, businessName, hunterKey } = req.body || {};
  if (!website && !businessName) return res.status(400).json({ ok: false, error: 'Falta website o businessName' });

  if (website) {
    const fromSite = await scrapeEmailFromSite(website);
    if (fromSite) return res.json({ ok: true, email: fromSite, source: 'sitio web' });
  }

  if (hunterKey) {
    const fromHunter = website
      ? await hunterEmail(website, hunterKey)
      : await hunterEmailByCompany(businessName, hunterKey);
    if (fromHunter) return res.json({ ok: true, email: fromHunter, source: 'hunter.io' });
  }

  return res.json({ ok: true, email: null });
});

module.exports = router;
