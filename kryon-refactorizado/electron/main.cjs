/**
 * electron/main.cjs — Punto de entrada de la app de escritorio. Abre el
 * mismo frontend estático (index.html) en una ventana nativa; el backend
 * sigue siendo el que esté configurado en kryon.config.json (por defecto,
 * el desplegado en Vercel), así que esta capa no duplica lógica de negocio.
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Empaquetado: kryon.config.json vive junto al .exe (fuera del asar) para que
// se pueda editar con cualquier editor de texto. En desarrollo, en la raíz del
// proyecto.
const configDir = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');
const configPath = path.join(configDir, 'kryon.config.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'AXIOM CORE · KRYON',
    backgroundColor: '#0b0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--kryon-config=${configPath}`]
    }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
