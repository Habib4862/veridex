/**
 * connections.js — Registro de las 10 conexiones externas de AXIOM CORE
 * y una cola con prioridad para limitar llamadas API concurrentes.
 *
 * Nota de honestidad: Supabase, Resend, Anthropic, Stripe, Meta, TikTok,
 * LinkedIn y GA4 tienen un endpoint de salud real implementado (vía backend,
 * o directo al frontend en el caso de Supabase). Google Ads usa OAuth2 con
 * varias credenciales (client id/secret, refresh token) en lugar de una
 * sola clave pegada, así que no se puede verificar en vivo con este campo
 * único — se expone como tarjeta de formato/credenciales lista para
 * conectarse cuando se implemente ese flujo OAuth.
 *
 * GA4 no usa una clave simple: en su campo se pega el JSON completo de la
 * cuenta de servicio de Google Cloud (con client_email y private_key) más
 * un campo "property_id" añadido a mano con el ID de la propiedad de GA4.
 */
const CONNECTIONS_REGISTRY = [
  { id: 'stripe', name: 'Stripe', color: '#635bff', storageKey: 'axiom_key_stripe', live: false, keyPattern: /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/, liveTest: true },
  { id: 'meta', name: 'Meta Ads', color: '#0866ff', storageKey: 'axiom_key_meta', live: false, keyPattern: /^.{16,}$/, liveTest: true },
  { id: 'google_ads', name: 'Google Ads', color: '#fbbc05', storageKey: 'axiom_key_google_ads', live: false, keyPattern: /^.{16,}$/, liveTest: false },
  { id: 'tiktok', name: 'TikTok', color: '#ff0050', storageKey: 'axiom_key_tiktok', live: false, keyPattern: /^.{16,}$/, liveTest: true },
  { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', storageKey: 'axiom_key_linkedin', live: false, keyPattern: /^.{16,}$/, liveTest: true },
  { id: 'x', name: 'X (Twitter)', color: '#e2e4ed', storageKey: 'axiom_key_x', live: false, keyPattern: /^.{16,}$/, liveTest: true },
  { id: 'ga4', name: 'Google Analytics 4', color: '#f9ab00', storageKey: 'axiom_key_ga4', live: true, keyPattern: /^\{(?=.*"private_key")(?=.*"client_email")(?=.*"property_id").+\}$/s, liveTest: true },
  { id: 'supabase', name: 'Supabase', color: '#3ecf8e', storageKey: 'axiom_supabase_key', live: true, keyPattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, liveTest: true },
  { id: 'resend', name: 'Resend', color: '#000000', storageKey: 'axiom_key_resend', live: true, keyPattern: /^re_[A-Za-z0-9_]+$/, liveTest: true },
  { id: 'anthropic', name: 'Anthropic', color: '#d97757', storageKey: 'axiom_key_anthropic', live: true, keyPattern: /^sk-ant-[A-Za-z0-9_-]+$/, liveTest: true }
];

class ConnectionsManager {
  constructor(supabaseClient) {
    this.cloud = supabaseClient;
  }

  list() {
    return CONNECTIONS_REGISTRY.map(c => ({
      ...c,
      configured: typeof localStorage !== 'undefined' && !!localStorage.getItem(c.storageKey)
    }));
  }

  isConfigured(id) {
    const c = CONNECTIONS_REGISTRY.find(x => x.id === id);
    return !!c && typeof localStorage !== 'undefined' && !!localStorage.getItem(c.storageKey);
  }

  setKey(id, value) {
    const c = CONNECTIONS_REGISTRY.find(x => x.id === id);
    if (!c || typeof localStorage === 'undefined') return;
    if (value) localStorage.setItem(c.storageKey, value);
    else localStorage.removeItem(c.storageKey);
  }

  configuredRatio() {
    const all = this.list();
    return all.filter(c => c.configured).length / all.length;
  }

  isCloudConnected() {
    return !!this.cloud?.connected;
  }

  /** @returns {boolean} true si `value` cumple el formato esperado de la clave (chequeo offline, sin red) */
  validateFormat(id, value) {
    const c = CONNECTIONS_REGISTRY.find(x => x.id === id);
    if (!c || !value) return false;
    return c.keyPattern.test(value.trim());
  }

  /** @returns {boolean} true si esta integración tiene verificación en vivo real (vs. solo chequeo de formato) */
  supportsLiveTest(id) {
    const c = CONNECTIONS_REGISTRY.find(x => x.id === id);
    return !!c?.liveTest;
  }

  getKey(id) {
    const c = CONNECTIONS_REGISTRY.find(x => x.id === id);
    if (!c || typeof localStorage === 'undefined') return '';
    return localStorage.getItem(c.storageKey) || '';
  }
}

/**
 * Cola de tareas asíncronas con prioridad, para no saturar APIs externas
 * (Claude, Supabase, futuras integraciones) con llamadas concurrentes.
 */
class APIQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.queue = [];
    this.active = 0;
  }

  /** @param {Function} task función async a ejecutar @param {number} priority mayor = antes */
  push(task, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, priority, resolve, reject });
      this.queue.sort((a, b) => b.priority - a.priority);
      this._drain();
    });
  }

  _drain() {
    if (this.active >= this.concurrency || this.queue.length === 0) return;
    const { task, resolve, reject } = this.queue.shift();
    this.active++;
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => { this.active--; this._drain(); });
  }
}

(function (g) {
  g.CONNECTIONS_REGISTRY = CONNECTIONS_REGISTRY;
  g.ConnectionsManager = ConnectionsManager;
  g.APIQueue = APIQueue;
})(typeof window !== 'undefined' ? window : globalThis);
