/**
 * connections.js — Registro de las 10 conexiones externas de AXIOM CORE
 * y una cola con prioridad para limitar llamadas API concurrentes.
 *
 * Nota de honestidad: solo Supabase, Resend y Anthropic tienen un endpoint
 * de salud real implementado (vía backend). Stripe, Meta, Google Ads,
 * TikTok, LinkedIn, X y GA4 se exponen como tarjetas de estado/credenciales
 * listas para que cada integración real se conecte sin tocar la UI.
 */
const CONNECTIONS_REGISTRY = [
  { id: 'stripe', name: 'Stripe', color: '#635bff', storageKey: 'axiom_key_stripe', live: false },
  { id: 'meta', name: 'Meta Ads', color: '#0866ff', storageKey: 'axiom_key_meta', live: false },
  { id: 'google_ads', name: 'Google Ads', color: '#fbbc05', storageKey: 'axiom_key_google_ads', live: false },
  { id: 'tiktok', name: 'TikTok', color: '#ff0050', storageKey: 'axiom_key_tiktok', live: false },
  { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', storageKey: 'axiom_key_linkedin', live: false },
  { id: 'x', name: 'X (Twitter)', color: '#e2e4ed', storageKey: 'axiom_key_x', live: false },
  { id: 'ga4', name: 'Google Analytics 4', color: '#f9ab00', storageKey: 'axiom_key_ga4', live: false },
  { id: 'supabase', name: 'Supabase', color: '#3ecf8e', storageKey: 'axiom_supabase_key', live: true },
  { id: 'resend', name: 'Resend', color: '#000000', storageKey: 'axiom_key_resend', live: true },
  { id: 'anthropic', name: 'Anthropic', color: '#d97757', storageKey: 'axiom_key_anthropic', live: true }
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
