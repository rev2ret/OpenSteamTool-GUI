const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a', // slate-900
    autoHideMenuBar: true,
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
      const releaseDir = path.join(__dirname, '../../build/Release');
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
