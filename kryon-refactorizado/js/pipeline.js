/**
 * pipeline.js — Generación de oportunidades/clientes y las 5 etapas del
 * embudo de ventas: nuevo → contactado → demo_enviada → aprobado → completado.
 *
 * No toca el DOM ni localStorage directamente: notifica cambios a través
 * de los hooks recibidos en el constructor (inyección de dependencias),
 * para mantenerse testeable de forma aislada.
 */
class PipelineManager {
  /**
   * @param {object} store referencia mutable { clients, opportunities, portfolio, apps }
   * @param {object} hooks { onXp(agentId, amount), onLog(msg), onPersist() }
   */
  constructor(store, hooks = {}) {
    this.store = store;
    this.hooks = hooks;
  }

  generateClient() {
    return {
      id: 'c_' + Date.now() + Math.random(),
      name: ['María García', 'Carlos López', 'Ana Martínez'][Math.floor(Math.random() * 3)],
      sector: ['Legaltech', 'Ecommerce', 'Salud'][Math.floor(Math.random() * 3)],
      need: ['Web', 'Ventas', 'Expandir'][Math.floor(Math.random() * 3)],
      budget: Math.floor(Math.random() * 10000) + 2000,
      stage: 'nuevo',
      project_id: this.store.activeProjectId
    };
  }

  generateOpp() {
    return {
      id: 'o_' + Date.now() + Math.random(),
      name: `${['SaaS', 'Ecommerce', 'Marketplace'][Math.floor(Math.random() * 3)]}: ${['IA', 'eco', 'premium'][Math.floor(Math.random() * 3)]}`,
      investment: Math.floor(Math.random() * 50000) + 5000,
      monthlyProfit: Math.floor(Math.random() * 8000) + 1000,
      risk: ['Bajo', 'Medio', 'Alto'][Math.floor(Math.random() * 3)],
      project_id: this.store.activeProjectId
    };
  }

  _xp(agentId, amount) { this.hooks.onXp?.(agentId, amount); }
  _log(msg) { this.hooks.onLog?.(msg); }

  contactClient(id) {
    const c = this.store.clients.find(x => x.id === id);
    if (!c) return null;
    c.stage = 'contactado';
    this._xp('clientes', 10);
    this._log(`${c.name} contactado`);
    return c;
  }

  sendDemo(id, code) {
    const c = this.store.clients.find(x => x.id === id);
    if (!c || c.stage !== 'contactado') return null;
    const app = { id: 'a_' + Date.now(), name: `Demo ${c.sector}`, code: code || `<h1>Demo para ${c.name}</h1>`, status: 'demo', clientId: c.id, project_id: this.store.activeProjectId };
    this.store.apps.unshift(app);
    c.stage = 'demo_enviada';
    c.demoId = app.id;
    this._xp('developer', 15);
    this._log('Demo enviada');
    return { client: c, app };
  }

  approveClient(id) {
    const c = this.store.clients.find(x => x.id === id);
    if (!c || c.stage !== 'demo_enviada') return null;
    c.stage = 'aprobado';
    this._xp('clientes', 20);
    this._log(`${c.name} aprobó`);
    return c;
  }

  completeProduct(id) {
    const c = this.store.clients.find(x => x.id === id);
    if (!c || c.stage !== 'aprobado') return null;
    c.stage = 'completado';
    this.store.portfolio.cash += c.budget;
    this.store.portfolio.total += c.budget;
    this._xp('finanzas', 25);
    this._log(`+€${c.budget} cobrado`);
    return c;
  }

  /** Avanza al primer cliente disponible en cada etapa, en orden. @returns {boolean} true si avanzó algo */
  runSalesCycle() {
    const order = ['nuevo', 'contactado', 'demo_enviada', 'aprobado'];
    for (const stage of order) {
      const c = this.store.clients.find(x => x.stage === stage);
      if (!c) continue;
      if (stage === 'nuevo') this.contactClient(c.id);
      else if (stage === 'contactado') this.sendDemo(c.id);
      else if (stage === 'demo_enviada') this.approveClient(c.id);
      else if (stage === 'aprobado') this.completeProduct(c.id);
      return true;
    }
    return false;
  }

  autoScan() {
    const opp = this.generateOpp();
    this.store.opportunities.unshift(opp);
    if (this.store.opportunities.length > 20) this.store.opportunities.pop();
    this._xp('oportunidad', 5);
    this._log('Oportunidad detectada');
    return opp;
  }

  autoFindClients() {
    const client = this.generateClient();
    this.store.clients.unshift(client);
    if (this.store.clients.length > 15) this.store.clients.pop();
    this._xp('marketing', 5);
    this._log('Cliente detectado');
    return client;
  }

  updateInvestments() {
    const p = this.store.portfolio;
    p.returns = (p.returns || 0) + Math.floor(Math.random() * 50) - 10;
    p.total = (p.cash || 0) + (p.invested || 0) + p.returns;
  }

  analyzeInvestment() {
    const opp = this.generateOpp();
    this.store.opportunities.unshift(opp);
    const amt = Math.floor(Math.random() * 3000) + 1000;
    this.store.portfolio.invested += amt;
    this.store.portfolio.cash -= amt;
    this.store.portfolio.total = this.store.portfolio.cash + this.store.portfolio.invested + (this.store.portfolio.returns || 0);
    this._xp('finanzas', 8);
    this._log(`€${amt} invertido`);
    return { opp, amt };
  }
}

(function (g) {
  g.PipelineManager = PipelineManager;
})(typeof window !== 'undefined' ? window : globalThis);
