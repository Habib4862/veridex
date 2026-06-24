/**
 * assistant.js — Cliente del "Asistente" del panel: un chat con Claude que,
 * además de responder, puede usar herramientas para configurar el panel o
 * avanzar el pipeline de clientes. Este archivo es deliberadamente "tonto":
 * solo define qué herramientas existen y cómo llamar al backend. Quién
 * decide qué hace cada herramienta de verdad (y qué confirmaciones exige)
 * vive en app.js, reutilizando exactamente las mismas funciones que usan
 * los botones del panel — así el asistente nunca tiene más permisos que el
 * propio usuario pulsando botones a mano.
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
  }
];

const ASSISTANT_SYSTEM_PROMPT = `Eres el asistente integrado en KRYON, un panel de automatización de ventas (prospección, demos con IA, cobros con Stripe).
Hablas en español, de forma breve y directa. Tienes herramientas para consultar el estado del panel y avanzar el pipeline de clientes.
Reglas importantes:
- Nunca inventes datos del negocio del usuario ni de sus clientes: si necesitas saber algo, usa una herramienta para consultarlo primero.
- No puedes ver ni cambiar claves de API (Anthropic/Resend/Stripe/Google Places): si el usuario pide configurarlas, dile que las pegue él mismo en la pestaña "Conexiones" — tú no tienes acceso a ese campo por seguridad.
- Las acciones que envían un email o generan un cobro real ya abren su propio modal de confirmación dentro del panel: nunca afirmes que algo "ya se envió" solo por haber llamado a la herramienta, espera el resultado.
- Si el usuario pide algo ambiguo (por ejemplo, no dice qué cliente), pregunta antes de actuar.`;

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
}

(function (g) {
  g.AssistantService = AssistantService;
})(typeof window !== 'undefined' ? window : globalThis);
