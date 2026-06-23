/**
 * electron/main.cjs — Punto de entrada de la app de escritorio. Abre el
 * mismo frontend estático (index.html) en una ventana nativa; el backend
 * sigue siendo el que esté configurado en kryon.config.json (por defecto,
 * el desplegado en Vercel), así que esta capa no duplica lógica de negocio.
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'AXIOM CORE · KRYON',
    backgroundColor: '#0b0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
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
