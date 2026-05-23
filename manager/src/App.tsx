import { useState, useEffect } from 'react';
import './index.css';

function App() {
  const [steamPath, setSteamPath] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    async function init() {
      if (window.api) {
        const path = await window.api.getSteamPath();
        setSteamPath(path);
        
        if (window.api.onPatchStatus) {
          window.api.onPatchStatus((msg: string) => {
            setStatusMsg(msg);
          });
        }
      }
    }
    init();
  }, []);

  const handleAutoPatch = async () => {
    if (!steamPath) return;
    setStatusMsg('Patching Steam...');
    const result = await window.api.autoPatch(steamPath);
    setStatusMsg(result.message);
  };

  const handleRestartSteam = async () => {
    if (!steamPath) return;
    setStatusMsg('Restarting Steam...');
    const result = await window.api.restartSteam(steamPath);
    setStatusMsg(result.message);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!steamPath) {
      setStatusMsg('Steam Path not found. Cannot install.');
      return;
    }

    const files = Array.from(e.dataTransfer.files)
      .map((f: any) => {
        // Fallback to f.path if getFilePath isn't available (e.g. older Electron)
        return window.api.getFilePath ? window.api.getFilePath(f) : f.path;
      })
      .filter((p) => typeof p === 'string' && p.length > 0);
      
    if (files.length === 0) {
      setStatusMsg('No valid files detected in the drop.');
      return;
    }

    setStatusMsg(`Installing ${files.length} files...`);
    const result = await window.api.installMods(steamPath, files);
    setStatusMsg(result.message);
  };

  return (
    <div className="container">
      <div className="header">
        <h1>OpenSteamTool Manager</h1>
        <p className="subtitle">Automated patching and config manager</p>
      </div>

      <div className="card">
        <div className="info-row">
          <strong>Steam Path:</strong> {steamPath || 'Not Found'}
        </div>

        <div className="actions">
          <button onClick={handleAutoPatch} disabled={!steamPath} className="btn primary">
            Install / Auto-Patch
          </button>
          <button onClick={handleRestartSteam} disabled={!steamPath} className="btn secondary">
            Restart Steam
          </button>
        </div>
      </div>

      <div 
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="drop-content">
          <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p>Drag & Drop <strong>.lua</strong> scripts and <strong>.manifest</strong> files here</p>
        </div>
      </div>

      {statusMsg && (
        <div className="status-bar">
          {statusMsg}
        </div>
      )}
    </div>
  );
}

export default App;
