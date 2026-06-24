/**
 * assistant.js — Cliente del "Asistente" del panel: un chat con Claude que,
 * además de responder, puede usar herramientas para configurar el panel o
 * avanzar el pipeline de clientes. Este archivo es deliberadamente "tonto":
 * solo define qué herramientas existen y cómo llamar al backend. Quién
 * decide qué hace cada herramienta de verdad (y qué confirmaciones exige)
 * vive en app.js, reutilizando exactamente las mismas funciones que usan
 * los botones del panel — así el asistente nunca tiene más permisos que el
 * propio usuario pulsando botones a mano.
 *
 * Por decisión explícita del usuario: el asistente puede configurar
 * directamente todo lo que NO sea una clave/credencial (perfil, backend,
 * tema, agentes, vigilancia, proyectos, opt-outs, pipeline). Las claves de
 * API y la contraseña maestra quedan fuera a propósito: si viajaran por
 * esta conversación, pasarían por los servidores de Anthropic y quedarían
 * guardadas en el historial del chat — eso el usuario lo rechazó.
 */
const ASSISTANT_TOOLS = [
  {
    name: 'get_panel_status',
    description: 'Devuelve el estado actual del panel: qué conexiones (Anthropic, Resend, Stripe, Google Places) están configuradas, si hay backend y "Email de envío" configurados, y cuántos clientes hay por etapa del pipeline.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'list_clients',
    description: 'Lista los clientes del pipeline, opcionalmente filtrados por etapa.',
    input_schema: {
      type: 'object',
      properties: {
        stage: { type: 'string', enum: ['nuevo', 'contactado', 'demo_enviada', 'aprobado', 'completado'], description: 'Etapa por la que filtrar. Si se omite, devuelve todos.' }
      }
    }
  },
  {
    name: 'set_backend_url',
    description: 'Configura la URL del backend desplegado (Vercel, etc.). Requiere recargar la página para tener efecto.',
    input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
  },
  {
    name: 'set_business_profile',
    description: 'Actualiza los datos del negocio que firman los emails: nombre del negocio, nombre del remitente y/o el "Email de envío". Solo cambia los campos que se indiquen.',
    input_schema: {
      type: 'object',
      properties: {
        businessName: { type: 'string' },
        senderName: { type: 'string' },
        fromEmail: { type: 'string' }
      }
    }
  },
  {
    name: 'contact_client',
    description: 'Inicia el contacto con un cliente en etapa "nuevo" (abre un modal para revisar y confirmar el email antes de enviarlo de verdad).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    name: 'send_demo',
    description: 'Genera (con IA) y envía la demo a un cliente en etapa "contactado" (abre un modal para revisar y confirmar antes de enviarla de verdad).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    name: 'approve_client',
    description: 'Marca como aprobado a un cliente en etapa "demo_enviada" (el cliente le dijo que sí a la demo). Esto prepara el cobro, pero no envía ningún email por sí solo.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    name: 'request_payment',
    description: 'Genera/muestra el enlace de cobro de Stripe para un cliente en etapa "aprobado". El email con el enlace queda esperando aprobación manual en la pestaña "Agentes", nunca se envía solo.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    name: 'set_theme',
    description: 'Cambia el tema visual del panel.',
    input_schema: { type: 'object', properties: { theme: { type: 'string', enum: ['dark', 'light'] } }, required: ['theme'] }
  },
  {
    name: 'set_agents_enabled',
    description: 'Activa o desactiva los Agentes IA autónomos (generan demos automáticamente para clientes en etapa "contactado" y las dejan en cola de aprobación, nunca las envían solas).',
    input_schema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] }
  },
  {
    name: 'add_watchlist',
    description: 'Activa la vigilancia automática (búsqueda periódica de negocios reales vía Google Places) para un sector/ciudad. Repite la búsqueda sola mientras el panel esté abierto en el navegador.',
    input_schema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Ciudad o zona, ej. "Madrid".' },
        sector: { type: 'string', enum: ['Legaltech', 'Salud', 'Ecommerce', 'Restauracion', 'Belleza', 'Inmobiliaria', 'Fitness', 'Hosteleria'] },
        need: { type: 'string', enum: ['Web', 'Ventas', 'Expandir'] },
        intervalMinutes: { type: 'number', description: 'Cada cuántos minutos repetir la búsqueda (30, 60, 180 o 1440).' }
      },
      required: ['location']
    }
  },
  {
    name: 'remove_watchlist',
    description: 'Detiene la vigilancia automática de una ciudad/zona (quita todas las entradas cuya ubicación coincida).',
    input_schema: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] }
  },
  {
    name: 'opt_out_client',
    description: 'Marca un cliente como "no contactar de nuevo" (deja de recibir cualquier email automático).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    name: 'switch_project',
    description: 'Cambia de proyecto activo (cada proyecto tiene su propio pipeline, clientes y apps).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    name: 'create_project',
    description: 'Crea un proyecto nuevo (no borra ni afecta a los proyectos existentes) y lo deja como activo.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    name: 'read_repo_file',
    description: 'Lee el contenido actual de un archivo del código fuente de KRYON (rutas relativas a la carpeta de la app, ej. "js/app.js"). Úsalo siempre antes de write_repo_file para ver el contenido real antes de modificarlo.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
  },
  {
    name: 'list_repo_dir',
    description: 'Lista los archivos y carpetas del código fuente de KRYON en una ruta dada (relativa a la carpeta de la app). Si se omite la ruta, lista la raíz de la app.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } } }
  },
  {
    name: 'write_repo_file',
    description: 'Sobrescribe un archivo del código fuente de KRYON con contenido nuevo: esto hace un commit directo a producción (sin ningún paso de confirmación) y Vercel lo despliega en cuanto llega. Debes pasar el contenido COMPLETO del archivo (nunca un fragmento parcial), tras haberlo leído antes con read_repo_file. Usa cambios mínimos y conservadores.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string', description: 'Contenido completo del archivo final, no un parche ni un fragmento.' },
        message: { type: 'string', description: 'Mensaje de commit. Si se omite, se genera uno automático.' }
      },
      required: ['path', 'content']
    }
  }
];

const ASSISTANT_SYSTEM_PROMPT = `Eres el asistente integrado en KRYON, un panel de automatización de ventas (prospección, demos con IA, cobros con Stripe).
Hablas en español, de forma breve y directa. Puedes configurar directamente casi cualquier parte del panel: perfil del negocio, URL del backend, tema visual, agentes IA, vigilancia automática de leads, proyectos y opt-outs de clientes, además de consultar el estado del panel y avanzar el pipeline de clientes. También puedes leer y arreglar el código fuente real de KRYON, como si fueras Claude Code.
Reglas importantes:
- Nunca inventes datos del negocio del usuario ni de sus clientes: si necesitas saber algo, usa una herramienta para consultarlo primero.
- Nunca puedes ver ni cambiar ninguna clave de API ni credencial (Anthropic/Resend/Stripe/Google Places/Supabase/contraseña maestra/GITHUB_TOKEN): si el usuario pide configurarlas, dile que las pegue él mismo en la pestaña "Conexiones" (o en Ajustes/Vercel según el caso) — el usuario decidió explícitamente que esas claves nunca pasen por esta conversación, así que rechaza pegarlas aquí aunque el usuario insista. Esto aplica también a archivos de código: nunca escribas una clave real ni inventada dentro de un archivo, aunque el usuario te lo pida.
- Las acciones que envían un email o generan un cobro real ya abren su propio modal de confirmación dentro del panel: nunca afirmes que algo "ya se envió" solo por haber llamado a la herramienta, espera el resultado.
- write_repo_file hace un commit directo a producción sin ningún paso de confirmación intermedio: úsalo con cuidado. Llama siempre primero a read_repo_file para ver el contenido real antes de tocarlo, escribe el archivo completo (nunca un fragmento), haz el cambio más mínimo y conservador posible para resolver lo pedido, y explica después qué cambiaste y por qué. Si el cambio te parece arriesgado o la petición es ambigua, pregunta antes de escribir.
- Si el usuario pide algo ambiguo (por ejemplo, no dice qué cliente, proyecto, ubicación o archivo), pregunta antes de actuar.`;

class AssistantService {
  /** @param {string} backendUrl */
  constructor(backendUrl = '') {
    this.backendUrl = backendUrl.replace(/\/$/, '');
    this.authPassword = '';
  }

  setAuthPassword(password) { this.authPassword = password; }

  static get tools() { return ASSISTANT_TOOLS; }
  static get systemPrompt() { return ASSISTANT_SYSTEM_PROMPT; }

  /**
   * Envía la conversación completa (formato Anthropic Messages, con bloques
   * de tipo text/tool_use/tool_result) y devuelve la respuesta cruda.
   * @param {Array} messages
   * @param {string} anthropicKey
   */
  async send(messages, anthropicKey) {
    if (!this.backendUrl) throw new Error('Configura la URL del backend en Ajustes primero');
    if (!anthropicKey) throw new Error('Configura tu clave de Anthropic en Conexiones primero');
    const r = await fetch(`${this.backendUrl}/api/claude/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': this.authPassword },
      body: JSON.stringify({ messages, key: anthropicKey, tools: ASSISTANT_TOOLS, system: ASSISTANT_SYSTEM_PROMPT })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || `El backend respondió ${r.status}`);
    return data;
  }

  async _repoRequest(endpoint, body) {
    if (!this.backendUrl) throw new Error('Configura la URL del backend en Ajustes primero');
    const r = await fetch(`${this.backendUrl}/api/repo/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': this.authPassword },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok || data.ok === false) throw new Error(data?.error || `El backend respondió ${r.status}`);
    return data;
  }

  /** @param {string} path */
  readRepoFile(path) { return this._repoRequest('read-file', { path }); }

  /** @param {string} [path] */
  listRepoDir(path) { return this._repoRequest('list-dir', { path }); }

  /**
   * @param {string} path
   * @param {string} content
   * @param {string} [message]
   */
  writeRepoFile(path, content, message) { return this._repoRequest('write-file', { path, content, message }); }
}

(function (g) {
  g.AssistantService = AssistantService;
})(typeof window !== 'undefined' ? window : globalThis);
