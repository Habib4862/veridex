/**
 * claude.js — Creador de entregables para clientes (sitio web, landing de
 * ventas, automatización real y funcional...). El tipo de entregable se adapta a la
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
  Expandir: 'una automatización real y funcional para una tarea concreta del día a día de ese negocio (por ejemplo: reserva de citas con detección de solapamientos y exportación a archivo .ics, un generador de presupuestos/facturas con cálculo automático e impresión a PDF, un formulario de captura de leads que guarda los envíos y permite exportarlos a CSV, o un sistema de respuestas automáticas por WhatsApp/email con plantillas predefinidas) — no es una maqueta visual de cómo se vería, es una herramienta que funciona de verdad al abrirla'
};
/** Instrucciones extra solo para automatizaciones: aquí es donde más se nota la
 * diferencia entre "simulación" y "funciona de verdad", así que se exige
 * explícitamente lógica real en JavaScript, no solo una vista bonita. */
const AUTOMATION_EXTRA = `Esta automatización tiene que funcionar de verdad dentro de la propia
  página, sin backend ni claves de API (todo en JavaScript vanilla, sin dependencias externas):
  elige UNA automatización concreta y útil para el sector y la necesidad descritos, e
  implementa su lógica real (validaciones de formulario, cálculos, detección de conflictos,
  guardado en localStorage, generación de archivos descargables como .ics/.csv/.txt mediante
  Blob y un enlace de descarga, etc.). Todo botón o formulario debe hacer algo real al
  pulsarlo. No incluyas ningún elemento decorativo que simule una acción sin ejecutarla.`;

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
    // Datos reales ya verificados (scraping de Google Places / web del negocio): si
    // existen hay que usarlos tal cual, en vez de dejar que el modelo invente otros —
    // el cliente real verá ese contacto reflejado en su propio entregable.
    const knownFacts = [
      client.address && `Dirección real: ${client.address}`,
      client.phone && `Teléfono real: ${client.phone}`,
      client.website && `Web real: ${client.website}`,
      client.email && `Email real: ${client.email}`
    ].filter(Boolean).join('\n');
    const factsBlock = knownFacts
      ? `Datos reales y verificados de la empresa (úsalos exactamente como aparecen, no inventes otros):\n${knownFacts}\n`
      : 'No hay datos de contacto verificados todavía: no inventes dirección, teléfono ni web concretos; usa solo un formulario de contacto o un texto genérico tipo "Contáctanos".\n';
    const automationBlock = client.need === 'Expandir' ? `${AUTOMATION_EXTRA}\n` : '';
    const rawPrompt = `Eres un diseñador y desarrollador senior especializado en crear entregables
      digitales de la máxima calidad posible. Crea ${brief} para ${client.name}, una empresa del
      sector ${client.sector}.
      ${factsBlock}
      ${automationBlock}
      Requisitos: una sola página HTML autocontenida con CSS embebido en <style> (sin
      dependencias ni librerías externas), diseño moderno y responsive, tipografía y
      espaciado cuidados, jerarquía visual clara y transiciones/hover sutiles en CSS
      donde aporten. No uses URLs de imágenes externas ni placeholders rotos: si
      quieres elementos visuales, créalos con CSS/SVG inline (gradientes, formas,
      iconos simples). Contenido específico y realista para ese sector y necesidad
      (nada de texto genérico tipo "Lorem ipsum"). Incluye cabecera con el nombre de
      la empresa y una propuesta de valor clara, y usa los datos reales de contacto
      indicados arriba si existen. Este entregable es lo primero que verá el cliente
      potencial, así que debe causar la mejor impresión profesional posible y
      ajustarse exactamente al tipo de necesidad descrito arriba.
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
