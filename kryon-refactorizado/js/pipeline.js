/**
 * pipeline.js — Convierte negocios reales encontrados (vía Google Places,
 * ver server/routes/leads.js) en oportunidades y clientes, y gestiona las 5
 * etapas del embudo de ventas: nuevo → contactado → demo_enviada → aprobado
 * → completado. completeProduct solo debe invocarse tras confirmar un pago
 * real de Stripe (ver App.showPaymentModal) — este módulo no genera ni
 * avanza clientes por sí solo.
 *
 * No toca el DOM ni localStorage directamente: notifica cambios a través
 * de los hooks recibidos en el constructor (inyección de dependencias),
 * para mantenerse testeable de forma aislada.
 */
/** Precio base por tipo de necesidad y factor de complejidad por sector regulado
 * (Legaltech y Salud requieren más cumplimiento/integraciones que un sitio genérico),
 * para que el presupuesto refleje el trabajo real en vez de ser puramente aleatorio. */
const NEED_PRICING = {
  Web: { base: 1500, variance: 1000 },
  Ventas: { base: 3500, variance: 1500 },
  Expandir: { base: 6000, variance: 2500 }
};
const SECTOR_FACTOR = {
  Legaltech: 1.25, Salud: 1.2, Ecommerce: 1.0,
  Restauracion: 1.0, Belleza: 0.95, Inmobiliaria: 1.15, Fitness: 1.0, Hosteleria: 1.1
};
/** Etiqueta del entregable según la necesidad, para que la lista de apps no
 * llame "Demo" a algo que en realidad es un sitio web o una automatización. */
const NEED_LABELS = { Web: 'Sitio web', Ventas: 'Página de ventas', Expandir: 'Automatización' };

class PipelineManager {
  /**
   * @param {object} store referencia mutable { clients, opportunities, portfolio, apps }
   * @param {object} hooks { onLog(msg), onPersist() }
   */
  constructor(store, hooks = {}) {
    this.store = store;
    this.hooks = hooks;
  }

  /** Calcula un presupuesto justo: precio base de la necesidad, ajustado por la
   * complejidad típica del sector, redondeado a múltiplos de 50. */
  static estimateBudget(need, sector) {
    const pricing = NEED_PRICING[need] || NEED_PRICING.Web;
    const factor = SECTOR_FACTOR[sector] || 1.0;
    const raw = (pricing.base + Math.random() * pricing.variance) * factor;
    return Math.round(raw / 50) * 50;
  }

  /** Convierte un negocio real devuelto por la búsqueda de leads (Google Places) en una
   * oportunidad: un negocio detectado, pendiente de convertirse en cliente del pipeline. */
  leadToOpportunity(lead, sector, need) {
    return {
      id: 'o_' + Date.now() + Math.random(),
      name: lead.name,
      address: lead.address || '',
      phone: lead.phone || '',
      website: lead.website || '',
      email: lead.email || '',
      placeId: lead.placeId || '',
      rating: typeof lead.rating === 'number' ? lead.rating : null,
      sector,
      need,
      project_id: this.store.activeProjectId
    };
  }

  /** Convierte una oportunidad (negocio real ya detectado) en un cliente del pipeline de ventas. */
  opportunityToClient(opp) {
    return {
      id: 'c_' + Date.now() + Math.random(),
      name: opp.name,
      sector: opp.sector,
      need: opp.need,
      address: opp.address || '',
      phone: opp.phone || '',
      website: opp.website || '',
      email: opp.email || '',
      placeId: opp.placeId || '',
      rating: typeof opp.rating === 'number' ? opp.rating : null,
      budget: PipelineManager.estimateBudget(opp.need, opp.sector),
      stage: 'nuevo',
      stageChangedAt: Date.now(),
      project_id: this.store.activeProjectId
    };
  }

  _log(msg) { this.hooks.onLog?.(msg); }

  contactClient(id) {
    const c = this.store.clients.find(x => x.id === id);
    if (!c) return null;
    c.stage = 'contactado';
    c.stageChangedAt = Date.now();
    this._log(`${c.name} contactado`);
    return c;
  }

  sendDemo(id, code) {
    const c = this.store.clients.find(x => x.id === id);
    if (!c || c.stage !== 'contactado') return null;
    const label = NEED_LABELS[c.need] || 'Demo';
    const app = { id: 'a_' + Date.now(), name: `${label} ${c.sector}`, code: code || `<h1>Demo para ${c.name}</h1>`, status: 'demo', clientId: c.id, project_id: this.store.activeProjectId };
    this.store.apps.unshift(app);
    c.stage = 'demo_enviada';
    c.stageChangedAt = Date.now();
    c.demoId = app.id;
    this._log('Demo enviada');
    return { client: c, app };
  }

  approveClient(id) {
    const c = this.store.clients.find(x => x.id === id);
    if (!c || c.stage !== 'demo_enviada') return null;
    c.stage = 'aprobado';
    c.stageChangedAt = Date.now();
    this._log(`${c.name} aprobó`);
    return c;
  }

  completeProduct(id) {
    const c = this.store.clients.find(x => x.id === id);
    if (!c || c.stage !== 'aprobado') return null;
    c.stage = 'completado';
    c.stageChangedAt = Date.now();
    this.store.portfolio.cash += c.budget;
    this.store.portfolio.total += c.budget;
    this._log(`+€${c.budget} cobrado`);
    return c;
  }

  /** Registra un negocio real recién encontrado como oportunidad. Llamado por
   * App tras una búsqueda de leads exitosa. */
  registerOpportunity(lead, sector, need) {
    const opp = this.leadToOpportunity(lead, sector, need);
    this.store.opportunities.unshift(opp);
    if (this.store.opportunities.length > 20) this.store.opportunities.pop();
    this._log(`Negocio real detectado: ${opp.name}`);
    return opp;
  }

  /** Convierte una oportunidad ya detectada en cliente del pipeline, moviéndola de
   * store.opportunities a store.clients. Llamado por App cuando el usuario decide
   * contactar a un negocio real concreto. */
  convertOpportunity(opportunityId) {
    const opp = this.store.opportunities.find(o => o.id === opportunityId);
    if (!opp) return null;
    const client = this.opportunityToClient(opp);
    this.store.clients.unshift(client);
    this.store.opportunities = this.store.opportunities.filter(o => o.id !== opportunityId);
    this._log(`${client.name} añadido al pipeline`);
    return client;
  }
}

(function (g) {
  g.PipelineManager = PipelineManager;
})(typeof window !== 'undefined' ? window : globalThis);
