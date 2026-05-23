const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getFilePath: (file) => webUtils.getPathForFile(file),
  getSteamPath: () => ipcRenderer.invoke('get-steam-path'),
  autoPatch: (steamPath) => ipcRenderer.invoke('auto-patch', steamPath),
  installMods: (steamPath, files) => ipcRenderer.invoke('install-mods', { steamPath, files }),
  downloadManifests: (steamPath, appid) => ipcRenderer.invoke('download-manifests', { steamPath, appid }),
  lookupAppId: (appid) => ipcRenderer.invoke('lookup-appid', appid),
  listInstalled: (steamPath) => ipcRenderer.invoke('list-installed', steamPath),
  removeGame: (steamPath, luaFile, depotIds) => ipcRenderer.invoke('remove-game', { steamPath, luaFile, depotIds }),
  restartSteam: (steamPath) => ipcRenderer.invoke('restart-steam', steamPath),
  onPatchStatus: (callback) => ipcRenderer.on('patch-status', (event, msg) => callback(msg)),
  onDownloadStatus: (callback) => ipcRenderer.on('download-status', (event, msg) => callback(msg))
});
