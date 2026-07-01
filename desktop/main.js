/**
 * Hermes Notes V2 — processus principal Electron (Windows).
 * Fenêtre unique chargeant le client web local (www/). Aucun accès Node
 * côté page : le client est une web app pure (IndexedDB + fetch).
 */
'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 380,
    minHeight: 520,
    backgroundColor: '#1e1f22',
    autoHideMenuBar: true,
    title: 'Hermes Notes',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'www', 'index.html'));

  // Les liens externes s'ouvrent dans le navigateur système, jamais dans l'app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
