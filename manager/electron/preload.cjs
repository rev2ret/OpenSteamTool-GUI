const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getFilePath: (file) => webUtils.getPathForFile(file),
  getSteamPath: () => ipcRenderer.invoke('get-steam-path'),
  autoPatch: (steamPath) => ipcRenderer.invoke('auto-patch', steamPath),
  installMods: (steamPath, files) => ipcRenderer.invoke('install-mods', { steamPath, files }),
  restartSteam: (steamPath) => ipcRenderer.invoke('restart-steam', steamPath),
  onPatchStatus: (callback) => ipcRenderer.on('patch-status', (event, msg) => callback(msg))
});
