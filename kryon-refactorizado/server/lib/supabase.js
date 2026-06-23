/**
 * lib/supabase.js — Cliente REST mínimo hacia PostgREST (Supabase), del
 * lado del servidor. Usa la service role key (nunca se expone al
 * frontend), a diferencia de js/supabase.js que usa la anon key.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function headers(extra = {}) {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, ...extra };
}

function isConfigured() {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

async function list(table, query = '') {
  if (!isConfigured()) return [];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers() });
  if (!r.ok) throw new Error(`Supabase ${table} list failed: ${r.status}`);
  return r.json();
}

async function insert(table, data) {
  if (!isConfigured()) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(`Supabase ${table} insert failed: ${r.status}`);
  return r.json();
}

async function update(table, id, data) {
  if (!isConfigured()) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(`Supabase ${table} update failed: ${r.status}`);
  return r.json();
}

async function remove(table, id) {
  if (!isConfigured()) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: headers() });
  if (!r.ok) throw new Error(`Supabase ${table} delete failed: ${r.status}`);
}

module.exports = { list, insert, update, remove, isConfigured };
