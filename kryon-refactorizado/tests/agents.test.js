import { describe, it, expect, beforeEach } from 'vitest';
import '../js/agents.js';

const { AgentsManager, AGENT_DEFS } = window;

describe('AgentsManager', () => {
  beforeEach(() => localStorage.clear());

  it('starts every agent at level 1 with 0 xp', () => {
    const mgr = new AgentsManager();
    expect(mgr.agents).toHaveLength(AGENT_DEFS.length);
    mgr.agents.forEach(a => { expect(a.level).toBe(1); expect(a.xp).toBe(0); });
  });

  it('grants xp and reports a level-up when crossing 100xp', () => {
    const mgr = new AgentsManager();
    expect(mgr.grantXp('marketing', 50)).toBe(false);
    expect(mgr.grantXp('marketing', 60)).toBe(true);
    expect(mgr.get('marketing').level).toBe(2);
  });

  it('returns false for an unknown agent id', () => {
    const mgr = new AgentsManager();
    expect(mgr.grantXp('inexistente', 100)).toBe(false);
  });

  it('persists and reloads xp/level per project', () => {
    const mgr = new AgentsManager();
    mgr.grantXp('developer', 250);
    mgr.save('proj1');

    const reloaded = new AgentsManager();
    reloaded.load('proj1');
    expect(reloaded.get('developer').xp).toBe(250);
    expect(reloaded.get('developer').level).toBe(3);
  });

  it('falls back to defaults when there is nothing saved for a project', () => {
    const mgr = new AgentsManager();
    mgr.load('proyecto-nuevo');
    expect(mgr.get('legal').xp).toBe(0);
  });

  it('computes xpProgress as the remainder within the current level', () => {
    const mgr = new AgentsManager();
    mgr.grantXp('finanzas', 130);
    expect(mgr.xpProgress(mgr.get('finanzas'))).toBe(30);
  });
});
