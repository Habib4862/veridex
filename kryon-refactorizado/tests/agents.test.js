import { describe, it, expect } from 'vitest';
import '../js/agents.js';

const { AgentsManager, AGENT_DEFS } = window;

function fakeConnections(configuredIds) {
  return { isConfigured: (id) => configuredIds.includes(id) };
}

describe('AgentsManager', () => {
  it('exposes every defined specialist with its real role', () => {
    const mgr = new AgentsManager();
    expect(mgr.agents).toHaveLength(AGENT_DEFS.length);
    mgr.agents.forEach(a => { expect(a.role).toBeTruthy(); });
  });

  it('an agent without a required integration is always operational', () => {
    const mgr = new AgentsManager();
    expect(mgr.isOperational('clientes', fakeConnections([]))).toBe(true);
    expect(mgr.isOperational('legal', fakeConnections([]))).toBe(true);
  });

  it('an agent that requires an integration is only operational once it is configured', () => {
    const mgr = new AgentsManager();
    expect(mgr.isOperational('developer', fakeConnections([]))).toBe(false);
    expect(mgr.isOperational('developer', fakeConnections(['anthropic']))).toBe(true);
    expect(mgr.isOperational('finanzas', fakeConnections(['anthropic']))).toBe(false);
  });

  it('returns false for an unknown agent id', () => {
    const mgr = new AgentsManager();
    expect(mgr.isOperational('inexistente', fakeConnections(['anthropic']))).toBe(false);
  });

  it('computes the operational ratio across all agents', () => {
    const mgr = new AgentsManager();
    const requiring = mgr.agents.filter(a => a.requires).map(a => a.requires);
    const ratioNone = mgr.operationalRatio(fakeConnections([]));
    const ratioAll = mgr.operationalRatio(fakeConnections(requiring));
    expect(ratioAll).toBe(1);
    expect(ratioNone).toBeLessThan(ratioAll);
  });
});
