/**
 * healer.js — Auto-sanación: diagnostica inconsistencias en los datos de la
 * tienda (clientes sin etapa, cartera con NaN, IDs duplicados...) y las
 * repara. También calcula las métricas reales de la pestaña "Salud".
 */
class HealerService {
  constructor() {
    this.lastRunAt = 0;
  }

  /** @param {object} store { clients, opportunities, apps, portfolio, logs } */
  diagnose(store) {
    const issues = [];
    (store.clients || []).forEach(c => {
      if (!c.stage) issues.push({ type: 'client_missing_stage', id: c.id });
      if (typeof c.budget !== 'number' || Number.isNaN(c.budget)) issues.push({ type: 'client_invalid_budget', id: c.id });
    });
    if (store.portfolio) {
      ['cash', 'invested', 'total', 'returns'].forEach(k => {
        if (typeof store.portfolio[k] !== 'number' || Number.isNaN(store.portfolio[k])) {
          issues.push({ type: 'portfolio_invalid_field', field: k });
        }
      });
    }
    const ids = (store.clients || []).map(c => c.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    dupes.forEach(id => issues.push({ type: 'duplicate_client_id', id }));
    return issues;
  }

  /** Repara en sitio los problemas detectados por diagnose(). @returns {number} reparaciones aplicadas */
  repair(store) {
    let fixed = 0;
    (store.clients || []).forEach(c => {
      if (!c.stage) { c.stage = 'nuevo'; fixed++; }
      if (typeof c.budget !== 'number' || Number.isNaN(c.budget)) { c.budget = 0; fixed++; }
    });
    if (store.portfolio) {
      ['cash', 'invested', 'total', 'returns'].forEach(k => {
        if (typeof store.portfolio[k] !== 'number' || Number.isNaN(store.portfolio[k])) {
          store.portfolio[k] = 0; fixed++;
        }
      });
    }
    const seen = new Set();
    if (store.clients) {
      store.clients = store.clients.filter(c => {
        if (seen.has(c.id)) { fixed++; return false; }
        seen.add(c.id);
        return true;
      });
    }
    this.lastRunAt = Date.now();
    return fixed;
  }

  /**
   * Métricas 0-100 para la pestaña Salud, basadas en estado real del
   * sistema en lugar de valores aleatorios.
   */
  healthReport(store, { brainHealthy = false, connectionsManager = null, agentsManager = null, lastBackupAt = 0 } = {}) {
    const minutesSinceBackup = lastBackupAt ? (Date.now() - lastBackupAt) / 60000 : 999;
    const stuckClients = (store.clients || []).filter(c => c.stage !== 'completado').length;
    const totalClients = (store.clients || []).length || 1;
    return {
      'Cerebro': brainHealthy ? 100 : 40,
      'Agentes': agentsManager ? Math.min(100, Math.round((agentsManager.averageLevel() / 5) * 100)) : 50,
      'Pipeline': Math.round(100 - (stuckClients / totalClients) * 40),
      'Detección': Math.min(100, (store.opportunities || []).length * 10),
      'Persistencia': this._hasLocalStorage() ? 100 : 0,
      'Conexiones': connectionsManager ? Math.round(connectionsManager.configuredRatio() * 100) : 0,
      'Backup': minutesSinceBackup < 6 ? 100 : Math.max(0, 100 - Math.round(minutesSinceBackup * 5)),
      'Sanación': this.lastRunAt ? 100 : 60
    };
  }

  _hasLocalStorage() {
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem('__axiom_probe__', '1');
      localStorage.removeItem('__axiom_probe__');
      return true;
    } catch {
      return false;
    }
  }
}

(function (g) {
  g.HealerService = HealerService;
})(typeof window !== 'undefined' ? window : globalThis);
