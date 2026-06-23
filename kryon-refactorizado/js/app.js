/**
 * app.js — Controlador principal de KRYON. Orquesta brain.js, supabase.js,
 * connections.js, agents.js, pipeline.js, healer.js y claude.js; gestiona
 * el DOM, persistencia, autenticación y el modo autónomo.
 */

/* ---------------------------- Utilidades ---------------------------- */

function debounce(fn, delay = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/** Hasta 2 iniciales en mayúscula a partir de un nombre. */
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}

/** Negro o blanco según la luminancia del color de fondo, para mantener contraste legible. */
function contrastColor(hex = '#888888') {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return '#fff';
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0b1220' : '#fff';
}

/** Iconos SVG inline (estilo Lucide) — sustituyen a los emojis de la UI. */
const Icons = {
  paths: {
    brain: '<path d="M12 2a4 4 0 0 0-4 4 4 4 0 0 0-3 6.6 4 4 0 0 0 1.3 7A4 4 0 0 0 12 22a4 4 0 0 0 5.7-2.4 4 4 0 0 0 1.3-7A4 4 0 0 0 16 6a4 4 0 0 0-4-4Z"/>',
    dashboard: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    pipeline: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    logs: '<path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M15 8h-5"/><path d="M15 12h-5"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>',
    flask: '<path d="M10 2v6.29a2 2 0 0 1-.5 1.32L4.21 16.5A2 2 0 0 0 6 20h12a2 2 0 0 0 1.79-3.5L14.5 9.6a2 2 0 0 1-.5-1.32V2"/><path d="M8.5 2h7"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    microscope: '<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    euro: '<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12a7.9 7.9 0 0 0 7.8 8 7.7 7.7 0 0 0 5.2-2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h.79a4.5 4.5 0 1 1 0 9Z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    scale: '<path d="M16 3h5v5M8 3H3v5M3 16v5h5M16 21h5v-5"/>',
    megaphone: '<path d="M3 11v3a1 1 0 0 0 1 1h2l3 5h2v-7M21 4 8 9H3v6h5l13 5z"/>',
    x: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>'
  },
  svg(name, size = 14) {
    const p = this.paths[name] || this.paths.sparkles;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }
};

/* ------------------------------- App ------------------------------- */

const App = {
  currentTab: 'dashboard',
  store: {
    projects: [], activeProjectId: null,
    opportunities: [], clients: [], apps: [], logs: [], history: [],
    portfolio: { total: 25000, cash: 10000, invested: 15000, returns: 0 }
  },
  chart: null, autoMode: false, intervals: [], startTime: Date.now(),
  backendUrl: '',
  lastBackupAt: 0,

  async init() {
    this.applyStoredTheme();
    BrainEngine.init();
    this.cloud = CloudDB;
    this.connections = new ConnectionsManager(this.cloud);
    this.agentsManager = new AgentsManager();
    this.healer = new HealerService();
    this.apiQueue = new APIQueue(2);
    this.claude = new ClaudeService(this.backendUrl, this.apiQueue);
    this.masterPassword = localStorage.getItem('axiom_master_pass') || '';
    this.claude.setAuthPassword(this.masterPassword);
    this.pipeline = new PipelineManager(this.store, {
      onXp: (agentId, amount) => this.agentsManager.grantXp(agentId, amount),
      onLog: (msg) => this.addLog(msg, 'info')
    });

    const connected = await this.cloud.init();
    if (connected) {
      document.getElementById('loginOverlay').style.display = 'flex';
      document.getElementById('loginStatus').textContent = 'Supabase conectado. Ingresa tu contraseña.';
    } else {
      document.getElementById('loginOverlay').style.display = 'flex';
      document.getElementById('loginStatus').textContent = 'Configura Supabase en Ajustes (abre el panel sin nube por ahora)';
      setTimeout(() => {
        document.getElementById('loginOverlay').style.display = 'none';
        this.renderSkeleton();
        this.loadLocal();
        this.afterLoad();
      }, 1500);
    }
    this.registerServiceWorker();
  },

  login() {
    const pass = document.getElementById('loginPass').value;
    if (pass === 'AXIOM2000' || pass === localStorage.getItem('axiom_master_pass')) {
      localStorage.setItem('axiom_master_pass', pass);
      this.masterPassword = pass;
      this.claude.setAuthPassword(pass);
      document.getElementById('loginOverlay').style.display = 'none';
      this.renderSkeleton();
      this.loadFromCloud().then(() => this.afterLoad());
    } else {
      document.getElementById('loginStatus').textContent = 'Contraseña incorrecta';
    }
  },

  afterLoad() {
    this.agentsManager.load(this.store.activeProjectId);
    this.renderShell();
    this.render(true);
    this.startCycles();
  },

  async loadFromCloud() {
    if (!this.cloud.connected) return this.loadLocal();
    const projects = await this.cloud.fetch('projects', 'order=created_at.desc');
    this.store.projects = projects.length ? projects : [{ id: 'main', name: 'Principal' }];
    this.store.activeProjectId = this.store.projects[0].id;
    await this.refreshFromCloud();
  },

  async refreshFromCloud() {
    if (!this.cloud.connected || !this.store.activeProjectId) return this.loadLocal();
    this.store.opportunities = await this.cloud.fetch('opportunities', `project_id=eq.${this.store.activeProjectId}&order=created_at.desc&limit=30`);
    this.store.clients = await this.cloud.fetch('clients', `project_id=eq.${this.store.activeProjectId}&order=created_at.desc&limit=30`);
    this.store.apps = await this.cloud.fetch('apps', `project_id=eq.${this.store.activeProjectId}&order=created_at.desc&limit=30`);
    const portfolios = await this.cloud.fetch('portfolio', `project_id=eq.${this.store.activeProjectId}&limit=1`);
    if (portfolios.length) this.store.portfolio = portfolios[0].data || this.store.portfolio;
    this.loadHistory();
    this.healer.repair(this.store);
    if (this.store.clients.length === 0) { for (let i = 0; i < 3; i++) { this.store.clients.push(this.pipeline.generateClient()); this.store.opportunities.push(this.pipeline.generateOpp()); } }
  },

  loadLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem('axiom_projects') || '[]');
      this.store.projects = saved.length ? saved : [{ id: 'main', name: 'Principal' }];
    } catch { this.store.projects = [{ id: 'main', name: 'Principal' }]; }
    this.store.activeProjectId = this.store.projects[0].id;
    try {
      const data = JSON.parse(localStorage.getItem(`axiom_data_${this.store.activeProjectId}`) || '{}');
      this.store.opportunities = data.opps || [];
      this.store.clients = data.clients || [];
      this.store.apps = data.apps || [];
      this.store.portfolio = data.portfolio || this.store.portfolio;
      this.store.logs = data.logs || [];
    } catch { this.store.opportunities = []; this.store.clients = []; this.store.apps = []; }
    this.loadHistory();
    this.healer.repair(this.store);
    if (this.store.clients.length === 0) { for (let i = 0; i < 3; i++) { this.store.clients.push(this.pipeline.generateClient()); this.store.opportunities.push(this.pipeline.generateOpp()); } }
  },

  saveLocal() {
    localStorage.setItem('axiom_projects', JSON.stringify(this.store.projects));
    localStorage.setItem(`axiom_data_${this.store.activeProjectId}`, JSON.stringify({
      opps: this.store.opportunities, clients: this.store.clients, apps: this.store.apps,
      portfolio: this.store.portfolio, logs: this.store.logs
    }));
    this.agentsManager.save(this.store.activeProjectId);
  },

  loadHistory() {
    try { this.store.history = JSON.parse(localStorage.getItem(`axiom_history_${this.store.activeProjectId}`) || '[]'); }
    catch { this.store.history = []; }
  },

  saveHistorySnapshot() {
    this.store.history.push({ t: Date.now(), opportunities: this.store.opportunities.length, clients: this.store.clients.length, apps: this.store.apps.length });
    if (this.store.history.length > 50) this.store.history.shift();
    localStorage.setItem(`axiom_history_${this.store.activeProjectId}`, JSON.stringify(this.store.history));
  },

  startCycles() {
    this.intervals.push(setInterval(() => this.autoScan(), 20000));
    this.intervals.push(setInterval(() => this.autoFindClients(), 25000));
    this.intervals.push(setInterval(() => this.pipeline.updateInvestments(), 30000));
    this.intervals.push(setInterval(() => this.autoBackup(), 300000));
    this.autoScan();
    this.autoFindClients();
  },

  clearIntervals() { this.intervals.forEach(clearInterval); this.intervals = []; },

  /* --------------------------- Tema claro/oscuro --------------------------- */
  applyStoredTheme() {
    const theme = localStorage.getItem('axiom_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  },
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('axiom_theme', next);
    this.renderShell();
    this.render(true);
  },

  /* --------------------------------- Render --------------------------------- */

  renderSkeleton() {
    document.getElementById('appShell').innerHTML = `
      <div class="card"><div class="skeleton skeleton-line" style="width:40%;"></div><div class="skeleton skeleton-metric"></div></div>
      <div class="grid grid-4">${[1,2,3,4].map(() => '<div class="card"><div class="skeleton skeleton-line" style="width:50%;"></div><div class="skeleton skeleton-metric"></div></div>').join('')}</div>`;
  },

  renderShell() {
    const opts = this.store.projects.map(p => `<option value="${p.id}" ${p.id === this.store.activeProjectId ? 'selected' : ''}>${p.name}</option>`).join('');
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    document.getElementById('appShell').innerHTML = `
      <header class="header">
        <div class="logo"><div class="logo-icon">K</div><div class="logo-text">AXIOM <span>CORE</span></div></div>
        <div class="header-actions">
          <span class="token-badge" style="color:${this.cloud.connected ? 'var(--green)' : 'var(--orange)'};">${Icons.svg(this.cloud.connected ? 'cloud' : 'database', 11)} ${this.cloud.connected ? 'Cloud' : 'Local'}</span>
          <span class="token-badge">${Icons.svg('euro', 11)} €${this.store.portfolio.total?.toLocaleString?.() || '25,000'}</span>
          <div class="project-selector"><select id="projectSelect" onchange="App.switchProject(this.value)">${opts}</select><button onclick="App.showNewProjectModal()" title="Nuevo proyecto">${Icons.svg('plus', 12)}</button></div>
          <button class="pill-btn gold" onclick="App.runSalesCycle()">${Icons.svg('pipeline', 13)} Pipeline</button>
          <button class="pill-btn primary" onclick="App.analyzeInvestment()">${Icons.svg('coins', 13)} Invertir</button>
          <button class="pill-btn" id="autoBtn" onclick="App.toggleAuto()" title="Activar/desactivar ciclo automático">${this.autoMode ? '<span class="live-dot"></span>' : Icons.svg('activity', 13)} Auto: ${this.autoMode ? 'ON' : 'OFF'}</button>
          <button class="pill-btn" onclick="App.exportPDF()">${Icons.svg('download', 13)} PDF</button>
          <button class="pill-btn" onclick="App.requestPush()" title="Activar notificaciones push">${Icons.svg('bell', 13)}</button>
          <button class="theme-toggle" onclick="App.toggleTheme()" title="Cambiar tema">${Icons.svg(theme === 'dark' ? 'sun' : 'moon', 14)}</button>
          <button class="pill-btn" onclick="App.showConfigModal()" title="Configuración de conexión cloud">${Icons.svg('settings', 13)}</button>
          <button class="pill-btn heal" onclick="App.forceHealing()" title="Forzar diagnóstico y auto-sanación">${Icons.svg('activity', 13)}</button>
        </div>
      </header>
      <nav class="nav-tabs" id="navTabs">
        <div class="nav-tab active" data-tab="dashboard">${Icons.svg('dashboard')} Dashboard</div>
        <div class="nav-tab" data-tab="pipeline">${Icons.svg('pipeline')} Pipeline</div>
        <div class="nav-tab" data-tab="clients">${Icons.svg('target')} Clientes</div>
        <div class="nav-tab" data-tab="creator">${Icons.svg('wrench')} Creador</div>
        <div class="nav-tab" data-tab="agents">${Icons.svg('cpu')} Agentes</div>
        <div class="nav-tab" data-tab="connections">${Icons.svg('cloud')} Conexiones</div>
        <div class="nav-tab" data-tab="pricing">${Icons.svg('coins')} Precios</div>
        <div class="nav-tab" data-tab="editor">${Icons.svg('code')} Editor</div>
        <div class="nav-tab" data-tab="health">${Icons.svg('heart')} Salud</div>
        <div class="nav-tab" data-tab="logs">${Icons.svg('logs')} Logs</div>
      </nav>
      <div class="main-content" id="mainContent"></div>`;
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        this.render(true);
      };
      if (tab.dataset.tab === this.currentTab) { document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); }
    });
  },

  /**
   * @param {boolean} animate Si es true, las tarjetas hacen fade-in (solo al
   * cambiar de pestaña/proyecto o cargar por primera vez). Los refrescos de
   * fondo (ciclos automáticos, acciones del pipeline) usan false para que el
   * contenido no parpadee (desaparezca y reaparezca) mientras el usuario mira.
   */
  render(animate = false) {
    const c = document.getElementById('mainContent');
    if (!c) return;
    switch (this.currentTab) {
      case 'dashboard': this.renderDashboard(c); break;
      case 'pipeline': this.renderPipeline(c); break;
      case 'clients': this.renderClients(c); break;
      case 'creator': this.renderCreator(c); break;
      case 'agents': this.renderAgents(c); break;
      case 'connections': this.renderConnections(c); break;
      case 'pricing': c.innerHTML = `<div class="card"><div class="card-header">${Icons.svg('euro')} Precios</div>
        <div class="grid grid-3">${[
          ['VERIDEX', '25€'], ['Landing', '500€'], ['App', '1000€'],
          ['Dashboard', '2500€'], ['Consultoría', '2000€'], ['Licencia KRYON', '149€/mes']
        ].map(([name, price]) => `<div class="price-card"><div class="price-name">${name}</div><div class="price-value">${price}</div></div>`).join('')}</div></div>`; break;
      case 'editor': this.renderEditor(c); break;
      case 'health': this.renderHealth(c); break;
      case 'logs': this.renderLogs(c); break;
    }
    if (animate) this.observeReveal();
  },

  renderDashboard(c) {
    c.innerHTML = `
      <div class="grid grid-4">
        <div class="card accent-cyan"><div class="card-header">${Icons.svg('target')} Oport</div><div class="metric-value">${this.store.opportunities.length}</div></div>
        <div class="card accent-purple"><div class="card-header">${Icons.svg('target')} Clientes</div><div class="metric-value">${this.store.clients.length}</div></div>
        <div class="card accent-green"><div class="card-header">${Icons.svg('wrench')} Apps</div><div class="metric-value">${this.store.apps.length}</div></div>
        <div class="card accent-gold"><div class="card-header">${Icons.svg('euro')} Cartera</div><div class="metric-value">€${(this.store.portfolio.total || 25000).toLocaleString()}</div></div>
      </div>
      <div class="grid grid-2">
        <div class="card"><div class="card-header">${Icons.svg('dashboard')} Evolución <button class="pill-btn" style="font-size:0.6rem;" onclick="App.toggleCompare()">Comparar proyectos</button></div><div class="chart-container"><canvas id="mainChart"></canvas></div><div id="compareArea"></div></div>
        <div class="card"><div class="card-header">${Icons.svg('logs')} Actividad</div><div class="log-panel" id="globalLog">${this.renderLogEntries(this.store.logs.slice(0, 25))}</div></div>
      </div>`;
    setTimeout(() => this.updateChart(), 300);
  },

  stageOrder: ['nuevo', 'contactado', 'demo_enviada', 'aprobado', 'completado'],

  stageTrackHtml(stage) {
    const idx = this.stageOrder.indexOf(stage);
    return `<div class="stage-track">${this.stageOrder.map((s, i) => `<span class="seg ${i <= idx ? 'done' : ''}"></span>`).join('')}</div>`;
  },

  renderPipeline(c) {
    c.innerHTML = `<div class="card"><div class="card-header">${Icons.svg('pipeline')} Pipeline <button class="pill-btn primary" onclick="App.runSalesCycle()">${Icons.svg('check', 12)} Ejecutar</button></div>
      <div class="node-list">${this.store.clients.map(cl => `
        <div class="node-item"><div class="avatar-circle">${this.initials(cl.name)}</div>
          <div style="flex:1;"><strong>${cl.name}</strong> · ${cl.sector} · €${cl.budget}${this.stageTrackHtml(cl.stage)}</div>
          <span class="pipeline-stage stage-${cl.stage}">${cl.stage.toUpperCase().replace('_', ' ')}</span>
          ${cl.stage === 'nuevo' ? `<button class="pill-btn primary" onclick="App.contactClient('${cl.id}')">${Icons.svg('mail', 12)}</button>` : ''}
          ${cl.stage === 'contactado' ? `<button class="pill-btn primary" onclick="App.sendDemo('${cl.id}')">${Icons.svg('flask', 12)}</button>` : ''}
          ${cl.stage === 'demo_enviada' ? `<button class="pill-btn approve" onclick="App.approveClient('${cl.id}')">${Icons.svg('check', 12)}</button>` : ''}
          ${cl.stage === 'aprobado' ? `<button class="pill-btn gold" onclick="App.completeProduct('${cl.id}')">${Icons.svg('microscope', 12)}</button>` : ''}
        </div>`).join('') || `<div class="empty-state">${Icons.svg('target', 28)}<span>Sin clientes en el pipeline</span></div>`}
      </div></div>`;
  },

  renderClients(c) {
    c.innerHTML = `<div class="card"><div class="card-header">${Icons.svg('target')} Clientes</div>
      <input class="search-input" id="clientSearch" placeholder="Buscar por nombre o sector...">
      <div class="node-list" id="clientList">${this.clientListHtml(this.store.clients)}</div></div>`;
    const input = document.getElementById('clientSearch');
    input.oninput = debounce((e) => {
      const q = e.target.value.trim().toLowerCase();
      const filtered = this.store.clients.filter(cl => cl.name.toLowerCase().includes(q) || cl.sector.toLowerCase().includes(q));
      document.getElementById('clientList').innerHTML = this.clientListHtml(filtered);
    }, 250);
  },

  clientListHtml(list) {
    return list.map(cl => `<div class="node-item"><div class="avatar-circle">${this.initials(cl.name)}</div><div style="flex:1;"><strong>${cl.name}</strong><div style="font-size:0.6rem;color:var(--muted);">${cl.sector} · €${cl.budget}</div>${this.stageTrackHtml(cl.stage)}</div><span class="pipeline-stage stage-${cl.stage}">${cl.stage.toUpperCase().replace('_', ' ')}</span></div>`).join('') || `<div class="empty-state">${Icons.svg('search', 28)}<span>Sin resultados</span></div>`;
  },

  slugify(name = '') { return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'demo'; },

  renderCreator(c) {
    const demos = this.store.apps.filter(a => a.status === 'demo'), done = this.store.apps.filter(a => a.status === 'completed');
    c.innerHTML = `<div class="grid grid-2">
      <div class="card"><div class="card-header">${Icons.svg('wrench')} Demos (${demos.length})</div>${demos.map(d => `<div class="node-item" onclick="App.preview('${d.id}')"><div class="node-dot" style="background:var(--gold);"></div><strong>${d.name}</strong></div>`).join('') || `<div class="empty-state">${Icons.svg('wrench', 24)}<span>Sin demos aún</span></div>`}</div>
      <div class="card"><div class="card-header">${Icons.svg('check')} Completadas</div>${done.map(d => `<div class="node-item"><div class="node-dot" style="background:var(--cyan);"></div><strong>${d.name}</strong></div>`).join('') || `<div class="empty-state">${Icons.svg('check', 24)}<span>Sin completar aún</span></div>`}</div>
      </div><div class="card"><div class="card-header">${Icons.svg('search')} Preview</div>
        <div class="browser-frame"><div class="browser-frame-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="url" id="previewUrl">kryon-demo.app</span></div>
        <div id="previewArea" style="height:300px;background:#fff;"></div></div></div>`;
  },

  renderAgents(c) {
    c.innerHTML = `<div class="grid grid-3">${this.agentsManager.agents.map(a => `
      <div class="card">
        <div class="agent-card-head"><div class="agent-avatar">${Icons.svg(a.icon, 17)}</div><div><div class="agent-name">${a.name}</div><span class="agent-level">Nv.${a.level}</span></div></div>
        <div style="font-size:0.55rem;color:var(--dim);">${a.xp} XP</div>
        <div class="xp-bar"><div class="xp-fill" style="width:${this.agentsManager.xpProgress(a)}%;"></div></div>
      </div>`).join('')}</div>`;
  },

  connectionCategories: {
    stripe: 'Pagos',
    meta: 'Marketing', google_ads: 'Marketing', tiktok: 'Marketing', linkedin: 'Marketing', x: 'Marketing',
    ga4: 'Analítica',
    supabase: 'Infraestructura', resend: 'Infraestructura',
    anthropic: 'IA'
  },

  renderConnections(c) {
    const list = this.connections.list();
    const categories = ['Pagos', 'Marketing', 'Analítica', 'Infraestructura', 'IA'];
    c.innerHTML = `<div class="card"><div class="card-header">${Icons.svg('cloud')} Conexiones (${list.filter(x => x.configured).length}/${list.length})</div>
      ${categories.map(cat => {
        const items = list.filter(conn => this.connectionCategories[conn.id] === cat);
        if (!items.length) return '';
        return `<div class="conn-category"><div class="conn-category-title">${cat}</div>
          <div class="grid grid-3">${items.map(conn => `
            <div class="card">
              <div class="card-header" style="color:${conn.color};"><span class="conn-badge" style="background:${conn.color};color:${this.contrastColor(conn.color)};">${this.initials(conn.name)}</span>${conn.name}</div>
              <div class="conn-status"><span class="connection-dot ${conn.configured ? 'on' : 'off'}"></span>${conn.configured ? 'Configurada' : 'Sin configurar'}${conn.live ? '' : ' · próximamente'}</div>
              <div class="conn-input-row">
                <input type="password" id="conn_input_${conn.id}" placeholder="${conn.configured ? '••••••••' : 'Pegar API key...'}">
                <button class="pill-btn primary" onclick="App.saveConnectionKey('${conn.id}')">${Icons.svg('check', 12)}</button>
                ${conn.configured ? `<button class="pill-btn" onclick="App.clearConnectionKey('${conn.id}')">${Icons.svg('x', 12)}</button>` : ''}
              </div>
            </div>`).join('')}</div></div>`;
      }).join('')}
      </div>`;
  },

  initials(name) { return initials(name); },
  contrastColor(hex) { return contrastColor(hex); },

  saveConnectionKey(id) {
    const input = document.getElementById(`conn_input_${id}`);
    const value = input?.value.trim();
    if (!value) return;
    this.connections.setKey(id, value);
    this.toast('Clave guardada');
    this.render();
  },

  clearConnectionKey(id) {
    this.connections.setKey(id, '');
    this.toast('Clave eliminada');
    this.render();
  },

  renderEditor(c) {
    c.innerHTML = `<div class="card"><div class="card-header">${Icons.svg('code')} Editor</div>
      <textarea class="code-editor" id="codeEditor" style="width:100%;min-height:300px;background:#000;color:var(--ice);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;">${this.store.apps[0]?.code || '<h1>Hola mundo</h1>'}</textarea>
      <button class="pill-btn primary" onclick="App.saveCode()" style="margin-top:8px;">${Icons.svg('check', 12)} Guardar</button>
      <div class="browser-frame" style="margin-top:8px;"><div class="browser-frame-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="url">kryon-demo.app/${this.slugify(this.store.apps[0]?.name)}</span></div>
      <div id="editorPreview" style="height:300px;background:#fff;"></div></div></div>`;
    document.getElementById('codeEditor').oninput = debounce(() => this.refreshEditorPreview(), 300);
    this.refreshEditorPreview();
  },

  refreshEditorPreview() {
    const code = document.getElementById('codeEditor')?.value || '';
    const preview = document.getElementById('editorPreview');
    if (preview) preview.innerHTML = `<iframe srcdoc="${code.replace(/"/g, '&quot;')}" style="width:100%;height:100%;border:none;"></iframe>`;
  },

  healthIcons: {
    'Cerebro': 'brain', 'Agentes': 'cpu', 'Pipeline': 'pipeline', 'Detección': 'search',
    'Persistencia': 'database', 'Conexiones': 'cloud', 'Backup': 'download', 'Sanación': 'heart'
  },

  healthStatus(val) {
    if (val > 80) return { label: 'Excelente', color: 'var(--green)' };
    if (val > 60) return { label: 'Bien', color: 'var(--green)' };
    if (val > 30) return { label: 'Atención', color: 'var(--orange)' };
    return { label: 'Crítico', color: 'var(--red)' };
  },

  renderHealth(c) {
    const report = this.healer.healthReport(this.store, {
      brainHealthy: BrainEngine.isHealthy(),
      connectionsManager: this.connections,
      agentsManager: this.agentsManager,
      lastBackupAt: this.lastBackupAt
    });
    const entries = Object.entries(report);
    const avg = Math.round(entries.reduce((s, [, v]) => s + v, 0) / entries.length);
    const avgStatus = this.healthStatus(avg);
    c.innerHTML = `<div class="card"><div class="card-header">${Icons.svg('heart')} Salud
        <button class="pill-btn primary" style="margin-left:auto;" onclick="App.forceHealing()">${Icons.svg('activity', 12)} Sanar ahora</button>
      </div>
      <div class="health-row"><span class="health-status" style="color:${avgStatus.color};">${avg}% — ${avgStatus.label} (promedio general)</span></div>
      <div class="health-bar"><div class="health-fill" style="width:${avg}%;background:${avgStatus.color};"></div></div>
      <div class="grid grid-2" style="margin-top:14px;">${entries.map(([name, val]) => {
        const status = this.healthStatus(val);
        return `<div class="card"><div class="card-header">${Icons.svg(this.healthIcons[name] || 'heart')} ${name}</div>
          <div class="health-row"><span class="health-status" style="color:${status.color};">${status.label}</span></div>
          <div class="health-bar"><div class="health-fill" style="width:${val}%;background:${status.color};"></div></div></div>`;
      }).join('')}</div></div>`;
  },

  renderLogs(c) {
    const levels = [['all', 'Todos'], ['info', 'Info'], ['warn', 'Warn'], ['error', 'Error'], ['debug', 'Debug']];
    c.innerHTML = `<div class="card"><div class="card-header">${Icons.svg('logs')} Logs</div>
      <div class="filter-chips">${levels.map(([key, label]) => `<span class="filter-chip ${key === 'all' ? 'active' : ''}" data-level="${key}">${label}</span>`).join('')}</div>
      <div class="log-panel" id="logsPanel" style="height:460px;">${this.renderLogEntries(this.store.logs)}</div></div>`;
    c.querySelectorAll('.filter-chip').forEach(chip => {
      chip.onclick = () => {
        c.querySelectorAll('.filter-chip').forEach(ch => ch.classList.remove('active'));
        chip.classList.add('active');
        const level = chip.dataset.level;
        const filtered = level === 'all' ? this.store.logs : this.store.logs.filter(l => (l.level || 'info') === level);
        document.getElementById('logsPanel').innerHTML = this.renderLogEntries(filtered);
      };
    });
  },

  renderLogEntries(logs) {
    return (logs || []).map(l => `<div class="log-entry"><span class="log-level log-level-${l.level || 'info'}">${(l.level || 'info').toUpperCase()}</span> [${new Date(l.time).toLocaleTimeString()}] ${l.msg}</div>`).join('') || `<div class="empty-state">${Icons.svg('logs', 26)}<span>Sin actividad</span></div>`;
  },

  /** Activa el fade-in + slide-up de tarjetas visibles (IntersectionObserver). */
  observeReveal() {
    const cards = document.querySelectorAll('#mainContent .card, #mainContent .grid > .card');
    if (!cards.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
    }, { threshold: 0.1 });
    cards.forEach((card, i) => { card.classList.add('reveal'); card.style.transitionDelay = `${Math.min(i, 8) * 40}ms`; observer.observe(card); });
  },

  /* ------------------------------ Chart histórico ------------------------------ */
  updateChart() {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;
    if (this.chart) this.chart.destroy();
    const hist = this.store.history.length ? this.store.history : [{ t: Date.now(), opportunities: this.store.opportunities.length, clients: this.store.clients.length, apps: this.store.apps.length }];
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const gridColor = isLight ? 'rgba(11,18,32,0.08)' : 'rgba(255,255,255,0.06)';
    const tickColor = isLight ? '#3c4357' : '#b6bacb';
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hist.map(h => new Date(h.t).toLocaleTimeString()),
        datasets: [
          { label: 'Oportunidades', data: hist.map(h => h.opportunities), borderColor: '#4df0ff', backgroundColor: 'rgba(77,240,255,0.08)', pointBackgroundColor: '#4df0ff', tension: 0.4, fill: true },
          { label: 'Clientes', data: hist.map(h => h.clients), borderColor: '#e8c97a', backgroundColor: 'rgba(232,201,122,0.08)', pointBackgroundColor: '#e8c97a', tension: 0.4, fill: true },
          { label: 'Apps', data: hist.map(h => h.apps), borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.08)', pointBackgroundColor: '#34d399', tension: 0.4, fill: true }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tickColor, font: { size: 11 } } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 } } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 } } }
        }
      }
    });
  },

  toggleCompare() {
    const area = document.getElementById('compareArea');
    if (!area) return;
    if (area.innerHTML) { area.innerHTML = ''; return; }
    const rows = this.store.projects.map(p => {
      let data = { opps: [], clients: [], apps: [] };
      try { data = JSON.parse(localStorage.getItem(`axiom_data_${p.id}`) || '{}'); } catch {}
      const active = p.id === this.store.activeProjectId;
      return `<tr class="${active ? 'active-row' : ''}"><td>${p.name}</td><td>${(data.opps || []).length}</td><td>${(data.clients || []).length}</td><td>${(data.apps || []).length}</td></tr>`;
    }).join('');
    area.innerHTML = `<table class="compare-table"><tr><th>Proyecto</th><th>Oport</th><th>Clientes</th><th>Apps</th></tr>${rows}</table>`;
  },

  /* ------------------------------ Acciones UI ------------------------------ */
  preview(id) {
    const app = this.store.apps.find(a => a.id === id);
    if (!app) return;
    document.getElementById('previewArea').innerHTML = `<iframe srcdoc="${(app.code || '').replace(/"/g, '&quot;')}" style="width:100%;height:100%;border:none;"></iframe>`;
    const urlEl = document.getElementById('previewUrl');
    if (urlEl) urlEl.textContent = `kryon-demo.app/${this.slugify(app.name)}`;
  },

  saveCode() {
    const code = document.getElementById('codeEditor')?.value || '';
    if (this.store.apps[0]) { this.store.apps[0].code = code; this.saveLocal(); }
    else { this.store.apps.unshift({ id: 'a_' + Date.now(), name: 'App', code, status: 'completed' }); this.saveLocal(); }
    this.refreshEditorPreview();
    this.toast('Guardado');
  },

  addLog(msg, level = 'info') {
    this.store.logs.unshift({ time: Date.now(), msg, level });
    if (this.store.logs.length > 100) this.store.logs.pop();
  },

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${Icons.svg('check', 14)}<span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300); }, 2500);
  },

  async autoScan() {
    const opp = this.pipeline.autoScan();
    if (this.cloud.connected) await this.cloud.insert('opportunities', opp);
    this.saveLocal();
    this.render();
  },

  async autoFindClients() {
    const client = this.pipeline.autoFindClients();
    if (this.cloud.connected) await this.cloud.insert('clients', client);
    this.saveLocal();
    this.render();
  },

  autoBackup() {
    this.saveLocal();
    this.saveHistorySnapshot();
    this.lastBackupAt = Date.now();
    if (this.cloud.connected && this.store.activeProjectId) {
      this.cloud.insert('portfolio', { project_id: this.store.activeProjectId, data: this.store.portfolio, updated_at: new Date().toISOString() });
    }
  },

  switchProject(id) {
    this.store.activeProjectId = id;
    (this.refreshFromCloud ? this.refreshFromCloud() : Promise.resolve(this.loadLocal())).then(() => {
      this.agentsManager.load(this.store.activeProjectId);
      this.renderShell();
      this.render(true);
    });
  },

  showNewProjectModal() {
    const name = prompt('Nombre del proyecto:');
    if (!name) return;
    const id = 'p_' + Date.now();
    this.store.projects.push({ id, name });
    this.store.activeProjectId = id;
    if (this.cloud.connected) this.cloud.insert('projects', { id, name, created_at: new Date().toISOString() });
    this.saveLocal();
    this.renderShell();
    this.render(true);
  },

  showConfigModal() {
    const url = localStorage.getItem('axiom_supabase_url') || '';
    const key = localStorage.getItem('axiom_supabase_key') || '';
    const content = `<h3>${Icons.svg('settings', 16)} Configuración Cloud</h3>
      <p>1. Crea cuenta en supabase.com<br>2. Ve a Settings &gt; API<br>3. Copia URL y anon key</p>
      <input id="cfg_url" value="${url}" placeholder="https://...supabase.co">
      <input id="cfg_key" value="${key}" placeholder="eyJhbGciOi...">
      <button class="pill-btn primary" onclick="CloudDB.setCredentials(document.getElementById('cfg_url').value,document.getElementById('cfg_key').value);alert('Guardado. Recarga la página.');location.reload();">${Icons.svg('check', 12)} Guardar y reconectar</button>`;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-card">${content}<button class="pill-btn" onclick="this.closest('.modal-overlay').remove()" style="margin-top:8px;">Cerrar</button></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },

  async contactClient(id) {
    const c = this.pipeline.contactClient(id);
    if (!c) return;
    this.saveLocal();
    if (this.cloud.connected) this.cloud.update('clients', id, { stage: 'contactado' });
    this.toast(`${c.name}`);
    this.renderShell(); this.render();
  },

  async sendDemo(id) {
    const result = this.pipeline.sendDemo(id);
    if (!result) return;
    const { client, app } = result;
    app.code = await this.claude.generateAppCode(client);
    this.saveLocal();
    if (this.cloud.connected) { this.cloud.insert('apps', app); this.cloud.update('clients', id, { stage: 'demo_enviada', demo_id: app.id }); }
    this.toast('Demo');
    this.renderShell(); this.render();
  },

  async approveClient(id) {
    const c = this.pipeline.approveClient(id);
    if (!c) return;
    this.saveLocal();
    if (this.cloud.connected) this.cloud.update('clients', id, { stage: 'aprobado' });
    this.renderShell(); this.render();
  },

  async completeProduct(id) {
    const c = this.pipeline.completeProduct(id);
    if (!c) return;
    this.saveLocal();
    if (this.cloud.connected) this.cloud.update('clients', id, { stage: 'completado' });
    this.toast(`€${c.budget}`);
    this.notify('AXIOM CORE', `${c.name} completó su producto (+€${c.budget})`);
    this.renderShell(); this.render();
  },

  async runSalesCycle() {
    const advanced = this.pipeline.runSalesCycle();
    this.saveLocal();
    this.renderShell(); this.render();
    if (!advanced) this.toast('Pipeline completo');
  },

  async analyzeInvestment() {
    const { amt } = this.pipeline.analyzeInvestment();
    this.saveLocal();
    if (this.cloud.connected) this.cloud.insert('opportunities', this.store.opportunities[0]);
    this.toast(`€${amt}`);
    this.render();
  },

  toggleAuto() {
    this.autoMode = !this.autoMode;
    document.getElementById('autoBtn').innerHTML = `${this.autoMode ? '<span class="live-dot"></span>' : Icons.svg('activity', 13)} Auto: ${this.autoMode ? 'ON' : 'OFF'}`;
    if (this.autoMode) this.runAuto();
  },

  async runAuto() {
    if (!this.autoMode) return;
    await this.runSalesCycle();
    if (Math.random() > 0.6) await this.analyzeInvestment();
    setTimeout(() => this.runAuto(), 25000);
  },

  forceHealing() {
    const issues = this.healer.diagnose(this.store);
    const fixed = this.healer.repair(this.store);
    this.saveLocal();
    this.addLog(`Auto-sanación ejecutada: ${issues.length} problema(s) detectado(s), ${fixed} reparado(s)`, fixed ? 'warn' : 'info');
    this.toast('Sistema verificado');
    if (this.currentTab === 'health') this.render();
  },

  /* ------------------------------ PDF / Push / SW ------------------------------ */
  exportPDF() {
    if (typeof html2pdf === 'undefined') { this.toast('html2pdf no disponible'); return; }
    const el = document.getElementById('mainContent');
    html2pdf().from(el).set({ filename: `kryon-informe-${Date.now()}.pdf`, margin: 10 }).save();
  },

  notify(title, body) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(title, { body });
  },

  async requestPush() {
    if (typeof Notification === 'undefined') { this.toast('Notificaciones no soportadas'); return; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { this.toast('Permiso denegado'); return; }
    this.toast('Notificaciones activadas');
    if ('serviceWorker' in navigator && this.backendUrl) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const keyRes = await fetch(`${this.backendUrl}/api/push/vapid-public-key`, { headers: { 'x-admin-password': this.masterPassword } });
        const { publicKey } = await keyRes.json();
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey });
        await fetch(`${this.backendUrl}/api/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': this.masterPassword }, body: JSON.stringify(sub) });
      } catch { /* backend de push no disponible: las notificaciones locales siguen funcionando */ }
    }
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
};

/* ---------------------------- Ripple effect ---------------------------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.pill-btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

document.addEventListener('DOMContentLoaded', () => App.init());

(function (g) {
  g.App = App;
  g.Icons = Icons;
  g.debounce = debounce;
  g.initials = initials;
  g.contrastColor = contrastColor;
})(typeof window !== 'undefined' ? window : globalThis);
