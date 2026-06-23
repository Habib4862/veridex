import { describe, it, expect, vi } from 'vitest';
import '../js/pipeline.js';

const { PipelineManager } = window;

function makeStore(overrides = {}) {
  return {
    clients: [], opportunities: [], apps: [],
    portfolio: { total: 25000, cash: 10000, invested: 15000, returns: 0 },
    activeProjectId: 'p1',
    ...overrides
  };
}

describe('PipelineManager — generación', () => {
  it('generateClient produces a client in stage "nuevo" tied to the active project', () => {
    const pm = new PipelineManager(makeStore());
    const c = pm.generateClient();
    expect(c.stage).toBe('nuevo');
    expect(c.project_id).toBe('p1');
    expect(typeof c.budget).toBe('number');
  });

  it('generateOpp produces an opportunity with investment and monthlyProfit', () => {
    const pm = new PipelineManager(makeStore());
    const o = pm.generateOpp();
    expect(o.investment).toBeGreaterThan(0);
    expect(o.monthlyProfit).toBeGreaterThan(0);
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

  it('runSalesCycle advances exactly one client per call and returns false when nothing is left', () => {
    const store = makeStore({ clients: [{ id: 'c1', name: 'Ana', sector: 'Salud', budget: 1000, stage: 'aprobado' }] });
    const pm = new PipelineManager(store);
    expect(pm.runSalesCycle()).toBe(true);
    expect(store.clients[0].stage).toBe('completado');
    expect(pm.runSalesCycle()).toBe(false);
  });
});

describe('PipelineManager — integración de inversión y autoscan', () => {
  it('autoScan adds an opportunity and caps the list at 20 entries', () => {
    const store = makeStore({ opportunities: Array.from({ length: 20 }, (_, i) => ({ id: 'o' + i })) });
    const pm = new PipelineManager(store);
    pm.autoScan();
    expect(store.opportunities).toHaveLength(20);
  });

  it('analyzeInvestment moves money from cash to invested and keeps total consistent', () => {
    const store = makeStore();
    const pm = new PipelineManager(store);
    const { amt } = pm.analyzeInvestment();
    expect(store.portfolio.cash).toBe(10000 - amt);
    expect(store.portfolio.invested).toBe(15000 + amt);
    expect(store.portfolio.total).toBe(store.portfolio.cash + store.portfolio.invested + store.portfolio.returns);
  });
});
