import { describe, it, expect } from 'vitest';
import '../js/healer.js';

const { HealerService } = window;

function baseStore() {
  return {
    clients: [
      { id: 'c1', stage: 'nuevo', budget: 1000 },
      { id: 'c2', stage: null, budget: NaN },
      { id: 'c2', stage: 'contactado', budget: 500 } // duplicate id
    ],
    opportunities: [{ id: 'o1' }],
    apps: [],
    portfolio: { cash: 100, invested: NaN, total: 200, returns: 0 },
    logs: []
  };
}

describe('HealerService.diagnose', () => {
  it('detects missing stage, invalid budget, invalid portfolio fields and duplicate ids', () => {
    const healer = new HealerService();
    const issues = healer.diagnose(baseStore());
    const types = issues.map(i => i.type);
    expect(types).toContain('client_missing_stage');
    expect(types).toContain('client_invalid_budget');
    expect(types).toContain('portfolio_invalid_field');
    expect(types).toContain('duplicate_client_id');
  });

  it('reports no issues for a healthy store', () => {
    const healer = new HealerService();
    const store = { clients: [{ id: 'c1', stage: 'nuevo', budget: 100 }], portfolio: { cash: 1, invested: 1, total: 2, returns: 0 } };
    expect(healer.diagnose(store)).toHaveLength(0);
  });
});

describe('HealerService.repair', () => {
  it('fixes every detected issue in place and removes duplicates', () => {
    const healer = new HealerService();
    const store = baseStore();
    const fixed = healer.repair(store);
    expect(fixed).toBeGreaterThan(0);
    expect(store.clients).toHaveLength(2); // duplicate removed
    expect(store.clients.every(c => typeof c.budget === 'number' && !Number.isNaN(c.budget))).toBe(true);
    expect(store.clients.every(c => !!c.stage)).toBe(true);
    expect(store.portfolio.invested).toBe(0);
    healer.diagnose(store); // re-run should find nothing left
    expect(healer.diagnose(store)).toHaveLength(0);
  });
});

describe('HealerService.healthReport', () => {
  it('returns the 8 expected categories with values between 0 and 100', () => {
    const healer = new HealerService();
    const report = healer.healthReport({ clients: [], opportunities: [], portfolio: {} }, { brainHealthy: true });
    const keys = Object.keys(report);
    expect(keys).toEqual(['Cerebro', 'Agentes', 'Pipeline', 'Detección', 'Persistencia', 'Conexiones', 'Backup', 'Sanación']);
    keys.forEach(k => {
      expect(report[k]).toBeGreaterThanOrEqual(0);
      expect(report[k]).toBeLessThanOrEqual(100);
    });
  });

  it('scores Cerebro low when the brain engine is not running', () => {
    const healer = new HealerService();
    const report = healer.healthReport({ clients: [], portfolio: {} }, { brainHealthy: false });
    expect(report['Cerebro']).toBeLessThan(100);
  });
});
