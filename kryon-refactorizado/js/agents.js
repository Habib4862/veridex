/**
 * agents.js — Los 6 especialistas de AXIOM CORE. No hay XP ni niveles
 * ficticios: cada agente representa una función real del negocio (detectar
 * leads, escribir y enviar el primer contacto, programar la demo, cobrar,
 * cumplir la ley) y su estado se calcula a partir de si la integración real
 * que necesita para trabajar está configurada — no de una barra de progreso
 * inventada.
 */
const AGENT_DEFS = [
  { id: 'oportunidad', name: 'Detección', icon: 'search', role: 'Encuentra negocios reales que podrían necesitar tus servicios (Google Places).', requires: 'google_places' },
  { id: 'marketing', name: 'Marketing', icon: 'megaphone', role: 'Encuentra el email real del negocio y redacta/envía el primer contacto (Resend).', requires: 'resend' },
  { id: 'clientes', name: 'Clientes', icon: 'target', role: 'Gestiona el pipeline de ventas: contacto, demo, aprobación.', requires: null },
  { id: 'developer', name: 'Developer', icon: 'code', role: 'Diseña y programa la demo real (web, ventas o automatización) con Claude.', requires: 'anthropic' },
  { id: 'finanzas', name: 'Finanzas', icon: 'coins', role: 'Genera el cobro real con Stripe y confirma cuándo se ha pagado.', requires: 'stripe' },
  { id: 'legal', name: 'Legal', icon: 'scale', role: 'Exige que todo email automático identifique al remitente y ofrezca darse de baja.', requires: null }
];

class AgentsManager {
  constructor() {
    this.agents = AGENT_DEFS.map(a => ({ ...a }));
  }

  get(agentId) {
    return this.agents.find(a => a.id === agentId);
  }

  /** Un agente sin integración requerida siempre está operativo (su trabajo es
   * lógica interna); si la requiere, depende de que esa clave esté configurada. */
  isOperational(agentId, connectionsManager) {
    const agent = this.get(agentId);
    if (!agent) return false;
    if (!agent.requires) return true;
    return !!connectionsManager?.isConfigured(agent.requires);
  }

  /** @returns {number} 0-1, proporción de agentes operativos ahora mismo */
  operationalRatio(connectionsManager) {
    if (!this.agents.length) return 0;
    return this.agents.filter(a => this.isOperational(a.id, connectionsManager)).length / this.agents.length;
  }
}

(function (g) {
  g.AGENT_DEFS = AGENT_DEFS;
  g.AgentsManager = AgentsManager;
})(typeof window !== 'undefined' ? window : globalThis);
