/**
 * claude.js — Creador de entregables para clientes (sitio web, landing de
 * ventas, demo de automatización...). El tipo de entregable se adapta a la
 * necesidad del cliente (ver NEED_BRIEFS). Comprime prompts, cachea resultados
 * repetidos y delega la llamada real a Claude en el backend (server/),
 * que es quien guarda la API key. Si no hay backend disponible (modo
 * "abrir index.html directamente"), recurre a una plantilla local idéntica
 * a la del archivo original — el comportamiento previo nunca se rompe.
 */
/** Qué tipo de entregable conviene crear según la necesidad del cliente, para que
 * el prompt no esté limitado a "una demo" sino al mejor formato para cada caso. */
const NEED_BRIEFS = {
  Web: 'una página web completa y profesional para la empresa, con varias secciones que actúen como páginas reales de un sitio (inicio, servicios, sobre nosotros, contacto) navegables mediante anclas internas',
  Ventas: 'una página de ventas/landing orientada a conversión, con un embudo claro: propuesta de valor, prueba social, oferta concreta y llamadas a la acción potentes para vender el servicio o producto principal del cliente',
  Expandir: 'una demostración de un sistema o automatización (por ejemplo un flujo de trabajo visual, un panel de seguimiento de procesos o una vista de un sistema interno) que muestre cómo el cliente puede automatizar o escalar su negocio'
};

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
   * Genera el código HTML de una demo para un cliente con la clave real de
   * Anthropic del usuario (la misma que pegó en Conexiones). Sin esa clave
   * no se llama a ningún backend: se devuelve un marcador de posición que
   * dice claramente que no es la demo real, en vez de fingir una.
   * @param {{name:string, sector:string, need?:string}} client
   * @param {string} anthropicKey clave personal del usuario (sk-ant-...)
   * @returns {Promise<string>} HTML de la demo
   */
  async generateAppCode(client, anthropicKey) {
    if (!anthropicKey) return this._localTemplate(client);

    const brief = NEED_BRIEFS[client.need] || 'una demo de la máxima calidad posible para presentar el negocio del cliente';
    const rawPrompt = `Eres un diseñador y desarrollador senior especializado en crear entregables
      digitales de la máxima calidad posible. Crea ${brief} para ${client.name}, una empresa del
      sector ${client.sector}.
      Requisitos: una sola página HTML autocontenida con CSS embebido en <style> (sin
      dependencias externas), diseño moderno y responsive, tipografía y espaciado
      cuidados, y contenido específico y realista para ese sector y necesidad (nada
      de texto genérico tipo "Lorem ipsum"). Incluye cabecera con el nombre de la
      empresa y una propuesta de valor clara. Este entregable es lo primero que verá
      el cliente potencial, así que debe causar la mejor impresión profesional posible
      y ajustarse exactamente al tipo de necesidad descrito arriba.
      Devuelve únicamente el HTML, sin explicaciones.`;
    const prompt = this.compressPrompt(rawPrompt);
    const cacheKey = `${anthropicKey}|${prompt}`;
    const cached = this._cacheGet(cacheKey);
    if (cached) return cached;

    const task = () => this._callBackend(prompt, anthropicKey, client);
    const html = this.queue ? await this.queue.push(task, 1) : await task();
    this._cacheSet(cacheKey, html);
    return html;
  }

  async _callBackend(prompt, anthropicKey, client) {
    if (!this.backendUrl) return this._localTemplate(client);
    try {
      const r = await fetch(`${this.backendUrl}/api/claude/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': this.authPassword },
        body: JSON.stringify({ prompt, key: anthropicKey })
      });
      const data = await r.json();
      return data.html || this._localTemplate(client);
    } catch {
      return this._localTemplate(client);
    }
  }

  /** Marcador de posición honesto: se usa solo cuando no hay clave de
   * Anthropic configurada o la llamada real falla, y lo dice explícitamente
   * en vez de simular una demo terminada. */
  _localTemplate(client) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;padding:48px;text-align:center;color:#555;">
      <h1>Demo para ${client.name}</h1>
      <p>Esto es solo un marcador de posición: conecta tu clave de Anthropic en Conexiones para generar la demo real con IA.</p>
      </body></html>`;
  }
}

(function (g) {
  g.ClaudeService = ClaudeService;
})(typeof window !== 'undefined' ? window : globalThis);
