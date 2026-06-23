/**
 * supabase.js — Cliente REST mínimo para Supabase (sin SDK, vía fetch).
 * Responsabilidad única: hablar con PostgREST. No conoce nada del dominio
 * de KRYON (clientes, oportunidades, etc.) — eso vive en pipeline.js.
 */
class SupabaseClient {
  constructor() {
    this.url = '';
    this.key = '';
    this.connected = false;
  }

  /** Carga credenciales desde localStorage y verifica conectividad. */
  async init() {
    this.url = (typeof localStorage !== 'undefined' && localStorage.getItem('axiom_supabase_url')) || '';
    this.key = (typeof localStorage !== 'undefined' && localStorage.getItem('axiom_supabase_key')) || '';
    if (!this.url || !this.key) { this.connected = false; return false; }
    try {
      const r = await fetch(`${this.url}/rest/v1/projects?select=id&limit=1`, { headers: this._headers() });
      this.connected = r.ok || r.status === 406;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  setCredentials(url, key) {
    this.url = url;
    this.key = key;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('axiom_supabase_url', url);
      localStorage.setItem('axiom_supabase_key', key);
    }
  }

  _headers(extra = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, ...extra };
  }

  async fetch(table, query = '') {
    if (!this.connected) return [];
    try {
      const r = await fetch(`${this.url}/rest/v1/${table}?${query}`, { headers: this._headers() });
      return r.ok ? await r.json() : [];
    } catch {
      return [];
    }
  }

  async insert(table, data) {
    if (!this.connected) return null;
    try {
      const r = await fetch(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: this._headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(data)
      });
      const d = await r.json();
      return d?.[0] || null;
    } catch {
      return null;
    }
  }

  async update(table, id, data) {
    if (!this.connected) return;
    try {
      await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: this._headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data)
      });
    } catch {}
  }

  async delete(table, id) {
    if (!this.connected) return;
    try {
      await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: this._headers() });
    } catch {}
  }
}

const CloudDB = new SupabaseClient();

(function (g) {
  g.SupabaseClient = SupabaseClient;
  g.CloudDB = CloudDB;
})(typeof window !== 'undefined' ? window : globalThis);
