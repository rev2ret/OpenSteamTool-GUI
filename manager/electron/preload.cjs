const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getFilePath: (file) => (file && typeof file.path === 'string' ? file.path : null),
  closeApp: () => ipcRenderer.send('close-app'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  searchGame: (term) => ipcRenderer.invoke('search-game', term),
  getSteamPath: () => ipcRenderer.invoke('get-steam-path'),
  autoPatch: (steamPath) => ipcRenderer.invoke('auto-patch', steamPath),
  installMods: (steamPath, files) => ipcRenderer.invoke('install-mods', { steamPath, files }),
  installOnlineFix: (steamPath, appId, zipPath) => ipcRenderer.invoke('install-online-fix', { steamPath, appId, zipPath }),
  downloadManifests: (steamPath, appid, dlcs) => ipcRenderer.invoke('download-manifests', { steamPath, appid, dlcs }),
  lookupAppId: (appid) => ipcRenderer.invoke('lookup-appid', appid),
  listInstalled: (steamPath) => ipcRenderer.invoke('list-installed', steamPath),
  listSteamApps: (steamPath) => ipcRenderer.invoke('list-steam-apps', steamPath),
  removeGame: (steamPath, luaFile, depotIds) => ipcRenderer.invoke('remove-game', { steamPath, luaFile, depotIds }),
  restartSteam: (steamPath) => ipcRenderer.invoke('restart-steam', steamPath),
  onPatchStatus: (callback) => ipcRenderer.on('patch-status', (event, msg) => callback(msg)),
  onDownloadStatus: (callback) => ipcRenderer.on('download-status', (event, msg) => callback(msg))
});
