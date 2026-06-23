/**
 * electron/preload.cjs — Antes de que cargue la app, vuelca kryon.config.json
 * (si existe) sobre localStorage. Solo escribe los campos que el archivo
 * trae con valor: nunca borra ni pisa clientes, proyectos, historial ni
 * ninguna otra clave que la app ya tuviera guardada. Así, para configurar
 * algo basta con editar ese archivo y reabrir la app — sin tocar la UI.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'kryon.config.json');

const FIELD_TO_STORAGE_KEY = {
  backendUrl: 'axiom_backend_url',
  masterPassword: 'axiom_master_pass',
  supabaseUrl: 'axiom_supabase_url'
};

// Debe coincidir con storageKey de cada entrada en CONNECTIONS_REGISTRY (js/connections.js)
const CONNECTION_ID_TO_STORAGE_KEY = {
  stripe: 'axiom_key_stripe',
  meta: 'axiom_key_meta',
  google_ads: 'axiom_key_google_ads',
  tiktok: 'axiom_key_tiktok',
  linkedin: 'axiom_key_linkedin',
  x: 'axiom_key_x',
  ga4: 'axiom_key_ga4',
  supabase: 'axiom_supabase_key',
  resend: 'axiom_key_resend',
  anthropic: 'axiom_key_anthropic'
};

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function applyConfig(config) {
  if (!config) return;
  for (const [field, storageKey] of Object.entries(FIELD_TO_STORAGE_KEY)) {
    if (config[field]) window.localStorage.setItem(storageKey, config[field]);
  }
  if (config.connections) {
    for (const [id, storageKey] of Object.entries(CONNECTION_ID_TO_STORAGE_KEY)) {
      const value = config.connections[id];
      if (value) window.localStorage.setItem(storageKey, value);
    }
  }
}

applyConfig(readConfig());
