/**
 * claude.js — Creador de apps/demos. Comprime prompts, cachea resultados
 * repetidos y delega la llamada real a Claude en el backend (server/),
 * que es quien guarda la API key. Si no hay backend disponible (modo
 * "abrir index.html directamente"), recurre a una plantilla local idéntica
 * a la del archivo original — el comportamiento previo nunca se rompe.
 */
class ClaudeService {
  /**
   * @param {string} backendUrl base del backend, ej. 'http://localhost:3000'
   * @param {APIQueue} [queue] cola de prioridad compartida para no saturar la API
   */
  constructor(backendUrl = '', queue = null) {
    this.backendUrl = backendUrl.replace(/\/$/, '');
    this.cache = new Map();
    this.maxCacheEntries = 50;
    this.queue = queue;
    this.authPassword = '';
  }

  /** La contraseña maestra se reenvía al backend como cabecera de autenticación. */
  setAuthPassword(password) { this.authPassword = password; }

  /** Elimina espacios redundantes y comentarios para reducir tokens facturables. */
  compressPrompt(prompt) {
    return String(prompt)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  _cacheGet(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value); // LRU: refresca posición
    return value;
  }

  _cacheSet(key, value) {
    if (this.cache.size >= this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }

  /**
   * Genera el código HTML de una demo para un cliente.
   * @param {{name:string, sector:string, need?:string}} client
   * @returns {Promise<string>} HTML de la demo
   */
  async generateAppCode(client) {
    const rawPrompt = `Eres un diseñador y desarrollador web senior. Crea una demo HTML
      de la máxima calidad posible para ${client.name}, una empresa del sector
      ${client.sector} con esta necesidad: ${client.need || 'una solución digital general'}.
      Requisitos: una sola página HTML autocontenida con CSS embebido en <style> (sin
      dependencias externas), diseño moderno y responsive, tipografía y espaciado
      cuidados, y contenido específico y realista para ese sector y necesidad (nada
      de texto genérico tipo "Lorem ipsum"). Incluye cabecera con el nombre de la
      empresa, una propuesta de valor clara y al menos 2-3 secciones relevantes
      (servicios, beneficios, llamada a la acción). Esta demo es lo primero que verá
      el cliente potencial, así que debe causar la mejor impresión profesional posible.
      Devuelve únicamente el HTML, sin explicaciones.`;
    const prompt = this.compressPrompt(rawPrompt);
    const cached = this._cacheGet(prompt);
    if (cached) return cached;

    const task = () => this._callBackend(prompt, client);
    const html = this.queue ? await this.queue.push(task, 1) : await task();
    this._cacheSet(prompt, html);
    return html;
  }

  async _callBackend(prompt, client) {
    if (!this.backendUrl) return this._localTemplate(client);
    try {
      const r = await fetch(`${this.backendUrl}/api/claude/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': this.authPassword },
        body: JSON.stringify({ prompt })
      });
      if (!r.ok) return this._localTemplate(client);
      const data = await r.json();
      return data.html || this._localTemplate(client);
    } catch {
      return this._localTemplate(client);
    }
  }

  /** Plantilla idéntica a la generación original, usada como respaldo. */
  _localTemplate(client) {
    return `<h1>Demo para ${client.name}</h1>`;
  }
}

(function (g) {
  g.ClaudeService = ClaudeService;
})(typeof window !== 'undefined' ? window : globalThis);
