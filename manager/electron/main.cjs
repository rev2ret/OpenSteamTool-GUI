const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');
const AdmZip = require('adm-zip');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 720,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a', // slate-900
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png')
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

ipcMain.handle('get-steam-path', async () => {
  return new Promise((resolve) => {
    exec('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/);
      if (match && match[1]) {
        resolve(match[1].trim());
      } else {
        resolve(null);
      }
    });
  });
});

ipcMain.handle('auto-patch', async (event, steamPath) => {
  return new Promise((resolve) => {
    try {
      const isPackaged = app.isPackaged;
      const releaseDir = isPackaged 
        ? path.join(process.resourcesPath, 'dlls')
        : path.join(__dirname, '../../build/Release');
      const debugDir = path.join(__dirname, '../../build/Debug');
      const rootDir = path.join(__dirname, '../../');
      const dlls = ['OpenSteamTool.dll', 'dwmapi.dll', 'xinput1_4.dll'];
      
      const copyDlls = () => {
        let copied = 0;
        // Check Release first, then Debug
        const buildDir = fs.existsSync(releaseDir) && fs.existsSync(path.join(releaseDir, dlls[0])) 
          ? releaseDir : debugDir;

        for (const dll of dlls) {
          const src = path.join(buildDir, dll);
          const dest = path.join(steamPath, dll);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            copied++;
          }
        }
        return copied;
      };
      
      const patchProcess = () => {
        let copied = copyDlls();
        if (copied > 0) {
          resolve({ success: true, message: `Successfully patched Steam with ${copied} DLLs.` });
          return;
        }
        
        // If we reach here, DLLs are missing. Build them automatically!
        event.sender.send('patch-status', 'Building C++ DLLs from source... (This may take a few minutes)');
        exec('build.bat', { cwd: rootDir }, (error, stdout) => {
          if (error) {
            resolve({ success: false, message: 'Build failed: ' + error.message });
            return;
          }
          
          // Try copying again after build
          copied = copyDlls();
          if (copied > 0) {
            resolve({ success: true, message: `Build successful! Patched Steam with ${copied} DLLs.` });
          } else {
            resolve({ success: false, message: 'Build finished, but DLLs were still not found.' });
          }
        });
      };

      // Auto-kill steam before attempting to patch to avoid EBUSY locks
      event.sender.send('patch-status', 'Closing Steam to unlock files...');
      exec('taskkill /F /IM steam.exe /T', () => {
        // Wait 1.5 seconds to ensure handles are released
        setTimeout(patchProcess, 1500);
      });

    } catch (e) {
      resolve({ success: false, message: e.message });
    }
  });
});

ipcMain.handle('install-mods', async (event, { steamPath, files }) => {
  return new Promise((resolve) => {
    try {
      const luaDir = path.join(steamPath, 'config', 'lua');
      const depotDir = path.join(steamPath, 'depotcache');
      
      if (!fs.existsSync(luaDir)) fs.mkdirSync(luaDir, { recursive: true });
      if (!fs.existsSync(depotDir)) fs.mkdirSync(depotDir, { recursive: true });
      
      let installed = 0;
      for (const file of files) {
        if (!file || typeof file !== 'string') continue;
        
        try {
          const stat = fs.statSync(file);
          if (!stat.isFile()) continue;
        } catch (e) {
          continue; // File doesn't exist or can't be read
        }

        const ext = path.extname(file).toLowerCase();
        const basename = path.basename(file);
        
        if (ext === '.lua') {
          fs.copyFileSync(file, path.join(luaDir, basename));
          installed++;
        } else if (ext === '.manifest') {
          fs.copyFileSync(file, path.join(depotDir, basename));
          installed++;
        }
      }
      resolve({ success: true, message: `Installed ${installed} files.` });
    } catch (e) {
      resolve({ success: false, message: e.message });
    }
  });
});

ipcMain.handle('download-manifests', async (event, { steamPath, appid }) => {
  return new Promise((resolve) => {
    event.sender.send('download-status', `Checking database for AppID: ${appid}...`);
    
    // 1. Verify existence using Github API
    const verifyUrl = `https://api.github.com/repos/SSMGAlt/ManifestHub2/branches/${appid}`;
    const options = {
      headers: { 'User-Agent': 'OpenSteamTool-Manager' }
    };
    
    https.get(verifyUrl, options, (res) => {
      if (res.statusCode !== 200) {
        resolve({ success: false, message: `Manifests for AppID ${appid} were not found in the database (Status: ${res.statusCode}).` });
        return;
      }
      
      event.sender.send('download-status', `Found manifests for ${appid}. Downloading...`);
      
      const downloadUrl = `https://codeload.github.com/SSMGAlt/ManifestHub2/zip/refs/heads/${appid}`;
      const tempZipPath = path.join(__dirname, `../../temp_${appid}.zip`);
      const fileStream = fs.createWriteStream(tempZipPath);
      
      https.get(downloadUrl, options, (downloadRes) => {
        downloadRes.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          event.sender.send('download-status', 'Download complete. Extracting and installing...');
          
          try {
            const zip = new AdmZip(tempZipPath);
            const zipEntries = zip.getEntries();
            
            const luaDir = path.join(steamPath, 'config', 'lua');
            const depotDir = path.join(steamPath, 'depotcache');
            
            if (!fs.existsSync(luaDir)) fs.mkdirSync(luaDir, { recursive: true });
            if (!fs.existsSync(depotDir)) fs.mkdirSync(depotDir, { recursive: true });
            
            let installed = 0;
            
            for (const entry of zipEntries) {
              if (entry.isDirectory) continue;
              
              const ext = path.extname(entry.name).toLowerCase();
              if (ext === '.lua') {
                fs.writeFileSync(path.join(luaDir, entry.name), entry.getData());
                installed++;
              } else if (ext === '.manifest') {
                fs.writeFileSync(path.join(depotDir, entry.name), entry.getData());
                installed++;
              }
            }
            
            // Clean up zip
            fs.unlinkSync(tempZipPath);
            
            if (installed > 0) {
              resolve({ success: true, message: `Successfully fetched and installed ${installed} files for ${appid}!` });
            } else {
              resolve({ success: false, message: 'Archive downloaded but no .lua or .manifest files were found inside.' });
            }
            
          } catch (err) {
            resolve({ success: false, message: 'Error extracting zip: ' + err.message });
          }
        });
      }).on('error', (err) => {
        fs.unlinkSync(tempZipPath);
        resolve({ success: false, message: 'Download failed: ' + err.message });
      });
      
    }).on('error', (err) => {
      resolve({ success: false, message: 'API request failed: ' + err.message });
    });
  });
});

ipcMain.handle('restart-steam', async (event, steamPath) => {
  return new Promise((resolve) => {
    exec('taskkill /F /IM steam.exe', (error) => {
      // It's okay if it fails (steam might not be running)
      const steamExe = path.join(steamPath, 'steam.exe');
      exec(`start "" "${steamExe}"`, (startError) => {
        if (startError) {
          resolve({ success: false, message: startError.message });
        } else {
          resolve({ success: true, message: 'Steam is restarting...' });
        }
      });
    });
  });
});

ipcMain.handle('list-installed', async (event, steamPath) => {
  try {
    const luaDir = path.join(steamPath, 'config', 'lua');
    const depotDir = path.join(steamPath, 'depotcache');

    if (!fs.existsSync(luaDir)) return [];

    const luaFiles = fs.readdirSync(luaDir).filter(f => f.endsWith('.lua'));
    const games = [];

    for (const file of luaFiles) {
      const content = fs.readFileSync(path.join(luaDir, file), 'utf-8');
      
      // Try to extract AppID from the lua content or filename
      let appId = null;
      let gameName = file.replace('.lua', '');
      const depotIds = [];

      // Common pattern: addappid(XXXX, ...) or appid = XXXX
      const appIdMatch = content.match(/addappid\s*\(\s*(\d+)/i) 
        || content.match(/appid\s*=\s*(\d+)/i)
        || content.match(/app_?id\s*[:=]\s*(\d+)/i)
        || file.match(/^(\d+)\.lua$/);
      
      if (appIdMatch) {
        appId = appIdMatch[1];
      }

      // Extract depot IDs from lua content
      const depotMatches = content.matchAll(/adddepot\s*\(\s*(\d+)/gi);
      for (const m of depotMatches) {
        depotIds.push(m[1]);
      }

      // Count associated manifest files
      let manifestCount = 0;
      if (fs.existsSync(depotDir)) {
        const manifests = fs.readdirSync(depotDir);
        for (const depotId of depotIds) {
          const found = manifests.filter(m => m.startsWith(depotId + '_'));
          manifestCount += found.length;
        }
      }

      games.push({
        luaFile: file,
        appId,
        gameName,
        depotIds,
        manifestCount,
        fileSize: fs.statSync(path.join(luaDir, file)).size,
      });
    }

    return games;
  } catch (e) {
    return [];
  }
});

ipcMain.handle('remove-game', async (event, { steamPath, luaFile, depotIds }) => {
  try {
    const luaDir = path.join(steamPath, 'config', 'lua');
    const depotDir = path.join(steamPath, 'depotcache');
    let removed = 0;

    // Remove the lua script
    const luaPath = path.join(luaDir, luaFile);
    if (fs.existsSync(luaPath)) {
      fs.unlinkSync(luaPath);
      removed++;
    }

    // Remove associated manifests
    if (fs.existsSync(depotDir) && depotIds && depotIds.length > 0) {
      const manifests = fs.readdirSync(depotDir);
      for (const depotId of depotIds) {
        for (const manifest of manifests) {
          if (manifest.startsWith(depotId + '_') && manifest.endsWith('.manifest')) {
            fs.unlinkSync(path.join(depotDir, manifest));
            removed++;
          }
        }
      }
    }

    return { success: true, message: `Removed ${removed} files.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('lookup-appid', async (event, appid) => {
  return new Promise((resolve) => {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json[appid] && json[appid].success) {
            resolve({ success: true, name: json[appid].data.name });
          } else {
            resolve({ success: false, name: null });
          }
        } catch {
          resolve({ success: false, name: null });
        }
      });
    }).on('error', () => {
      resolve({ success: false, name: null });
    });
  });
});
