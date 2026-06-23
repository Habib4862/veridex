import { describe, it, expect, beforeEach } from 'vitest';
import '../js/agents.js';
import '../js/healer.js';
import '../js/pipeline.js';

const { AgentsManager, HealerService, PipelineManager } = window;

describe('Integración pipeline + agentes + sanación', () => {
  let store, agentsManager, healer, pipeline;

  beforeEach(() => {
    localStorage.clear();
    store = {
      clients: [], opportunities: [], apps: [],
      portfolio: { total: 25000, cash: 10000, invested: 15000, returns: 0 },
      logs: [], activeProjectId: 'proj-int'
    };
    agentsManager = new AgentsManager();
    healer = new HealerService();
    pipeline = new PipelineManager(store, {
      onXp: (agentId, amount) => agentsManager.grantXp(agentId, amount),
      onLog: (msg) => store.logs.unshift({ time: Date.now(), msg, level: 'info' })
    });
  });

  it('completing a full sales cycle levels up agents and logs every step', () => {
    store.clients.push({ id: 'c1', name: 'Ana', sector: 'Salud', budget: 5000, stage: 'nuevo' });

    for (let i = 0; i < 4; i++) pipeline.runSalesCycle();

    expect(store.clients[0].stage).toBe('completado');
    expect(store.portfolio.cash).toBe(15000);
    expect(agentsManager.get('clientes').xp).toBe(30); // contact(10) + approve(20)
    expect(agentsManager.get('developer').xp).toBe(15);
    expect(agentsManager.get('finanzas').xp).toBe(25);
    expect(store.logs.length).toBe(4);
  });

  it('healer repairs a store corrupted mid-cycle without losing pipeline progress', () => {
    store.clients.push({ id: 'c1', name: 'Carlos', sector: 'Ecommerce', budget: 2000, stage: 'nuevo' });
    pipeline.contactClient('c1');
    pipeline.sendDemo('c1');

    // simulate corruption: invalid budget + portfolio NaN
    store.clients[0].budget = NaN;
    store.portfolio.returns = NaN;

    const fixed = healer.repair(store);
    expect(fixed).toBeGreaterThan(0);
    expect(store.clients[0].stage).toBe('demo_enviada'); // progress preserved
    expect(store.clients[0].budget).toBe(0);
    expect(store.portfolio.returns).toBe(0);
  });

  it('health report reflects pipeline progress and agent growth together', () => {
    store.clients.push({ id: 'c1', name: 'Lucia', sector: 'Legaltech', budget: 3000, stage: 'nuevo' });
    for (let i = 0; i < 4; i++) pipeline.runSalesCycle();
    pipeline.autoScan();

    const report = healer.healthReport(store, { brainHealthy: true, agentsManager, lastBackupAt: Date.now() });
    expect(report['Pipeline']).toBe(100); // único cliente, ya completado
    expect(report['Detección']).toBeGreaterThan(0);
    expect(report['Backup']).toBe(100);
  });
});
