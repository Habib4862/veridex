/**
 * routes/leads.js — Búsqueda de negocios reales (Google Places API "Text
 * Search (New)") para alimentar el pipeline con clientes potenciales de
 * verdad, en vez de clientes generados al azar. La clave llega en el body
 * solo para esta llamada puntual; el backend no la persiste en ningún sitio.
 */
const express = require('express');
const router = express.Router();

/** Categoría de búsqueda real según el sector elegido, para que Google Places
 * devuelva negocios relevantes en vez de resultados genéricos. */
const SECTOR_QUERY = {
  Legaltech: 'abogados despacho legal',
  Salud: 'clínica médica dentista',
  Ecommerce: 'tienda comercio retail'
};

router.post('/search', async (req, res) => {
  const { key, sector, location } = req.body || {};
  if (!key || !location) return res.status(400).json({ ok: false, error: 'Falta key o location' });

  const query = `${SECTOR_QUERY[sector] || 'negocios'} en ${location}`;
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.id,places.rating'
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'es' })
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403 || data.error?.status === 'PERMISSION_DENIED') {
      return res.json({ ok: false, error: 'Clave de Google Places inválida o sin permisos (activa "Places API (New)" en Google Cloud Console)' });
    }
    if (!r.ok) return res.json({ ok: false, error: data.error?.message || `Google Places respondió ${r.status}` });

    const leads = (data.places || []).map(p => ({
      name: p.displayName?.text || 'Negocio sin nombre',
      address: p.formattedAddress || '',
      phone: p.nationalPhoneNumber || '',
      website: p.websiteUri || '',
      placeId: p.id || '',
      rating: p.rating ?? null
    }));
    return res.json({ ok: true, leads });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `No se pudo contactar la API de Google Places: ${e.message}` });
  }
});

module.exports = router;
