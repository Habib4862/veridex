import { describe, it, expect, vi } from 'vitest';
import '../js/pipeline.js';

const { PipelineManager } = window;

function makeStore(overrides = {}) {
  return {
    clients: [], opportunities: [], apps: [],
    portfolio: { total: 0, cash: 0 },
    activeProjectId: 'p1',
    ...overrides
  };
}

describe('PipelineManager — leads reales', () => {
  it('leadToOpportunity carries the real business data tied to the active project', () => {
    const pm = new PipelineManager(makeStore());
    const lead = { name: 'Clínica Dental Sonrisa', address: 'Calle Mayor 1, Madrid', phone: '+34911111111', website: 'https://sonrisa.es', placeId: 'abc123' };
    const opp = pm.leadToOpportunity(lead, 'Salud', 'Web');
    expect(opp.name).toBe('Clínica Dental Sonrisa');
    expect(opp.address).toBe('Calle Mayor 1, Madrid');
    expect(opp.sector).toBe('Salud');
    expect(opp.need).toBe('Web');
    expect(opp.project_id).toBe('p1');
  });

  it('opportunityToClient produces a client in stage "nuevo" with an estimated budget', () => {
    const pm = new PipelineManager(makeStore());
    const opp = { name: 'Despacho Legal Ruiz', sector: 'Legaltech', need: 'Ventas', address: 'Gran Vía 5', project_id: 'p1' };
    const c = pm.opportunityToClient(opp);
    expect(c.stage).toBe('nuevo');
    expect(c.name).toBe('Despacho Legal Ruiz');
    expect(c.project_id).toBe('p1');
    expect(typeof c.budget).toBe('number');
    expect(c.budget).toBeGreaterThan(0);
  });

  it('registerOpportunity adds a real lead to the store and caps the list at 20 entries', () => {
    const store = makeStore({ opportunities: Array.from({ length: 20 }, (_, i) => ({ id: 'o' + i })) });
    const pm = new PipelineManager(store);
    pm.registerOpportunity({ name: 'Nueva Tienda' }, 'Ecommerce', 'Web');
    expect(store.opportunities).toHaveLength(20);
    expect(store.opportunities[0].name).toBe('Nueva Tienda');
  });

  it('convertOpportunity moves a real lead from opportunities into clients', () => {
    const store = makeStore({ opportunities: [{ id: 'o1', name: 'Clínica X', sector: 'Salud', need: 'Web', project_id: 'p1' }] });
    const pm = new PipelineManager(store);
    const client = pm.convertOpportunity('o1');
    expect(client.name).toBe('Clínica X');
    expect(client.stage).toBe('nuevo');
    expect(store.opportunities).toHaveLength(0);
    expect(store.clients).toHaveLength(1);
  });

  it('convertOpportunity returns null for an unknown opportunity id', () => {
    const pm = new PipelineManager(makeStore());
    expect(pm.convertOpportunity('missing')).toBeNull();
  });
});

describe('PipelineManager — embudo de ventas', () => {
  it('walks a client through nuevo -> contactado -> demo_enviada -> aprobado -> completado', () => {
    const onXp = vi.fn();
    const onLog = vi.fn();
    const store = makeStore({ clients: [{ id: 'c1', name: 'Ana', sector: 'Salud', budget: 3000, stage: 'nuevo' }] });
    const pm = new PipelineManager(store, { onXp, onLog });

    pm.contactClient('c1');
    expect(store.clients[0].stage).toBe('contactado');

    pm.sendDemo('c1');
    expect(store.clients[0].stage).toBe('demo_enviada');
    expect(store.apps).toHaveLength(1);

    pm.approveClient('c1');
    expect(store.clients[0].stage).toBe('aprobado');

    const before = store.portfolio.cash;
    pm.completeProduct('c1');
    expect(store.clients[0].stage).toBe('completado');
    expect(store.portfolio.cash).toBe(before + 3000);

    expect(onXp).toHaveBeenCalledWith('clientes', 10);
    expect(onXp).toHaveBeenCalledWith('developer', 15);
    expect(onXp).toHaveBeenCalledWith('clientes', 20);
    expect(onXp).toHaveBeenCalledWith('finanzas', 25);
    expect(onLog).toHaveBeenCalled();
  });

  it('refuses to skip stages out of order', () => {
    const store = makeStore({ clients: [{ id: 'c1', name: 'Ana', sector: 'Salud', budget: 3000, stage: 'nuevo' }] });
    const pm = new PipelineManager(store);
    expect(pm.sendDemo('c1')).toBeNull(); // still "nuevo", not "contactado"
    expect(pm.approveClient('c1')).toBeNull();
    expect(pm.completeProduct('c1')).toBeNull();
  });

  it('completeProduct only credits money once a client reaches "aprobado" (real payment gate upstream)', () => {
    const store = makeStore({ clients: [{ id: 'c1', name: 'Ana', sector: 'Salud', budget: 1000, stage: 'aprobado' }] });
    const pm = new PipelineManager(store);
    const before = store.portfolio.cash;
    pm.completeProduct('c1');
    expect(store.clients[0].stage).toBe('completado');
    expect(store.portfolio.cash).toBe(before + 1000);
  });
});
