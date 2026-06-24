import { describe, it, expect, beforeEach } from 'vitest';
import '../js/agents.js';
import '../js/healer.js';
import '../js/pipeline.js';

const { AgentsManager, HealerService, PipelineManager } = window;

function fakeConnections(configuredIds) {
  return { isConfigured: (id) => configuredIds.includes(id), configuredRatio: () => 0.5 };
}

describe('Integración pipeline + agentes + sanación', () => {
  let store, agentsManager, healer, pipeline;

  beforeEach(() => {
    localStorage.clear();
    store = {
      clients: [], opportunities: [], apps: [],
      portfolio: { total: 0, cash: 0 },
      logs: [], activeProjectId: 'proj-int'
    };
    agentsManager = new AgentsManager();
    healer = new HealerService();
    pipeline = new PipelineManager(store, {
      onLog: (msg) => store.logs.unshift({ time: Date.now(), msg, level: 'info' })
    });
  });

  it('completing a full sales cycle logs every real step without granting any fake xp', () => {
    store.clients.push({ id: 'c1', name: 'Ana', sector: 'Salud', budget: 5000, stage: 'nuevo' });

    pipeline.contactClient('c1');
    pipeline.sendDemo('c1');
    pipeline.approveClient('c1');
    pipeline.completeProduct('c1');

    expect(store.clients[0].stage).toBe('completado');
    expect(store.portfolio.cash).toBe(5000);
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

  it('health report reflects pipeline progress and real agent operational status together', () => {
    store.clients.push({ id: 'c1', name: 'Lucia', sector: 'Legaltech', budget: 3000, stage: 'nuevo' });
    pipeline.contactClient('c1');
    pipeline.sendDemo('c1');
    pipeline.approveClient('c1');
    pipeline.completeProduct('c1');
    pipeline.registerOpportunity({ name: 'Negocio Real' }, 'Ecommerce', 'Web');

    const connections = fakeConnections(['anthropic', 'stripe', 'google_places', 'resend']);
    const report = healer.healthReport(store, { brainHealthy: true, agentsManager, connectionsManager: connections, lastBackupAt: Date.now() });
    expect(report['Pipeline']).toBe(100); // único cliente, ya completado
    expect(report['Detección']).toBeGreaterThan(0);
    expect(report['Backup']).toBe(100);
    expect(report['Agentes']).toBe(100); // todos los agentes requeridos están conectados
  });
});
