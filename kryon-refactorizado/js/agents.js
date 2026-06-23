/**
 * agents.js — Los 6 agentes de AXIOM CORE con experiencia (XP) y niveles.
 * Cada acción del pipeline otorga XP al agente responsable; el nivel sube
 * cada 100 XP. El estado se persiste en localStorage por proyecto.
 */
const AGENT_DEFS = [
  { id: 'marketing', name: 'Marketing', icon: 'megaphone' },
  { id: 'oportunidad', name: 'Oportunidad', icon: 'search' },
  { id: 'clientes', name: 'Clientes', icon: 'target' },
  { id: 'developer', name: 'Developer', icon: 'code' },
  { id: 'finanzas', name: 'Finanzas', icon: 'coins' },
  { id: 'legal', name: 'Legal', icon: 'scale' }
];

const XP_PER_LEVEL = 100;

class AgentsManager {
  constructor() {
    this.agents = AGENT_DEFS.map(a => ({ ...a, xp: 0, level: 1 }));
  }

  load(projectId) {
    try {
      const raw = localStorage.getItem(`axiom_agents_${projectId}`);
      if (raw) {
        const saved = JSON.parse(raw);
        this.agents = AGENT_DEFS.map(def => {
          const found = saved.find(s => s.id === def.id);
          return { ...def, xp: found?.xp || 0, level: found?.level || 1 };
        });
      } else {
        this.agents = AGENT_DEFS.map(a => ({ ...a, xp: 0, level: 1 }));
      }
    } catch {
      this.agents = AGENT_DEFS.map(a => ({ ...a, xp: 0, level: 1 }));
    }
  }

  save(projectId) {
    if (!projectId) return;
    localStorage.setItem(`axiom_agents_${projectId}`, JSON.stringify(this.agents));
  }

  /** Otorga XP a un agente y recalcula su nivel. @returns {boolean} true si subió de nivel */
  grantXp(agentId, amount) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return false;
    const prevLevel = agent.level;
    agent.xp += amount;
    agent.level = 1 + Math.floor(agent.xp / XP_PER_LEVEL);
    return agent.level > prevLevel;
  }

  get(agentId) {
    return this.agents.find(a => a.id === agentId);
  }

  averageLevel() {
    if (!this.agents.length) return 1;
    return this.agents.reduce((s, a) => s + a.level, 0) / this.agents.length;
  }

  xpProgress(agent) {
    return agent.xp % XP_PER_LEVEL;
  }
}

(function (g) {
  g.AGENT_DEFS = AGENT_DEFS;
  g.AgentsManager = AgentsManager;
})(typeof window !== 'undefined' ? window : globalThis);
