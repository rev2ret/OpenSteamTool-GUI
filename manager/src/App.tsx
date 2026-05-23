import { useState, useEffect, useCallback } from 'react';
import './index.css';

type Tab = 'fetcher' | 'files' | 'library';

interface InstalledGame {
  luaFile: string;
  appId: string | null;
  gameName: string;
  depotIds: string[];
  manifestCount: number;
  fileSize: number;
}

function App() {
  const [steamPath, setSteamPath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('fetcher');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');

  // Fetcher
  const [appId, setAppId] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  // Files
  const [isDragging, setIsDragging] = useState(false);

  // Library
  const [games, setGames] = useState<InstalledGame[]>([]);
  const [isLoadingLib, setIsLoadingLib] = useState(false);

  const showStatus = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusMsg(msg);
    setStatusType(type);
  };

  const loadLibrary = useCallback(async () => {
    if (!steamPath) return;
    setIsLoadingLib(true);
    const list = await window.api.listInstalled(steamPath);
    setGames(list || []);
    setIsLoadingLib(false);
  }, [steamPath]);

  useEffect(() => {
    async function init() {
      if (window.api) {
        const path = await window.api.getSteamPath();
        setSteamPath(path);

        window.api.onPatchStatus?.((msg: string) => showStatus(msg, 'info'));
        window.api.onDownloadStatus?.((msg: string) => showStatus(msg, 'info'));
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (activeTab === 'library' && steamPath) loadLibrary();
  }, [activeTab, steamPath, loadLibrary]);

  // ── Handlers ──────────────────────────────────────────────

  const handleAutoPatch = async () => {
    if (!steamPath) return;
    showStatus('Patching Steam...', 'info');
    const result = await window.api.autoPatch(steamPath);
    showStatus(result.message, result.success ? 'success' : 'error');
  };

  const handleRestart = async () => {
    if (!steamPath) return;
    showStatus('Restarting Steam...', 'info');
    const result = await window.api.restartSteam(steamPath);
    showStatus(result.message, result.success ? 'success' : 'error');
  };

  const handleFetch = async () => {
    if (!steamPath) { showStatus('Steam path not found.', 'error'); return; }
    if (!appId.match(/^\d+$/)) { showStatus('AppID must be numeric (e.g. 271590).', 'error'); return; }

    setIsFetching(true);
    showStatus('Searching database...', 'info');
    const result = await window.api.downloadManifests(steamPath, appId);
    showStatus(result.message, result.success ? 'success' : 'error');
    if (result.success) setAppId('');
    setIsFetching(false);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!steamPath) { showStatus('Steam path not found.', 'error'); return; }

    const files = Array.from(e.dataTransfer.files)
      .map((f: any) => window.api.getFilePath ? window.api.getFilePath(f) : f.path)
      .filter((p) => typeof p === 'string' && p.length > 0);

    if (files.length === 0) { showStatus('No valid files detected.', 'error'); return; }

    showStatus(`Installing ${files.length} files...`, 'info');
    const result = await window.api.installMods(steamPath, files);
    showStatus(result.message, result.success ? 'success' : 'error');
  };

  const handleRemoveGame = async (game: InstalledGame) => {
    if (!steamPath) return;
    showStatus(`Removing ${game.gameName}...`, 'info');
    const result = await window.api.removeGame(steamPath, game.luaFile, game.depotIds);
    showStatus(result.message, result.success ? 'success' : 'error');
    if (result.success) loadLibrary();
  };

  // ── Icons ─────────────────────────────────────────────────

  const IconFetch = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  );

  const IconFiles = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );

  const IconLibrary = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>
    </svg>
  );

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      <div className="bg-grid" />
      <div className="app-shell">
        {/* Title Bar */}
        <div className="titlebar">
          <div className="titlebar-dots">
            <div className="titlebar-dot red" />
            <div className="titlebar-dot yellow" />
            <div className="titlebar-dot green" />
          </div>
          <h1>SafeSteamTools</h1>
        </div>

        {/* Header */}
        <div className="header">
          <div className="header-logo">SafeSteamTools</div>
          <div className="header-sub">Automated patching · manifest fetcher · game library</div>
        </div>

        {/* Steam Path */}
        <div className="steam-path-pill">
          <div className={`dot ${steamPath ? 'connected' : 'disconnected'}`} />
          <span>{steamPath || 'Steam not found'}</span>
        </div>

        {/* Tab Navigation */}
        <div className="tab-nav">
          <button className={`tab-btn ${activeTab === 'fetcher' ? 'active' : ''}`} onClick={() => setActiveTab('fetcher')}>
            {IconFetch} Fetch
          </button>
          <button className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>
            {IconFiles} Files
          </button>
          <button className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
            {IconLibrary} Library
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content-area">

          {/* ── FETCHER TAB ───────────────────────────────── */}
          {activeTab === 'fetcher' && (
            <div className="tab-panel" key="fetcher">
              <div className="card">
                <div className="card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Auto-Fetcher
                </div>
                <div className="card-desc">
                  Enter a Steam AppID to instantly download and install manifests from the community database.
                </div>

                <div className="input-row">
                  <input
                    type="text"
                    placeholder="AppID (e.g. 271590)"
                    className="input-field"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                  />
                  <button
                    onClick={handleFetch}
                    disabled={!appId || isFetching}
                    className="btn btn-fetch"
                  >
                    {isFetching ? <span className="spinner" /> : 'Fetch'}
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  Quick Actions
                </div>
                <div className="card-desc">
                  Inject compiled DLLs into Steam or restart Steam to apply changes.
                </div>
                <div className="actions-row">
                  <button onClick={handleAutoPatch} disabled={!steamPath} className="btn btn-primary">
                    Auto-Patch
                  </button>
                  <button onClick={handleRestart} disabled={!steamPath} className="btn btn-secondary">
                    Restart Steam
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── FILES TAB ─────────────────────────────────── */}
          {activeTab === 'files' && (
            <div className="tab-panel" key="files">
              <div
                className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <div className="drop-content">
                  <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" strokeWidth="1.5" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p>Drag & drop <strong>.lua</strong> and <strong>.manifest</strong> files</p>
                </div>
              </div>

              <div className="card">
                <div className="card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                  </svg>
                  How it works
                </div>
                <div className="card-desc">
                  Drop your <strong>.lua</strong> scripts and <strong>.manifest</strong> files here.
                  They will be automatically sorted into Steam's <code>config/lua</code> and <code>depotcache</code> folders.
                  All other file types are safely ignored.
                </div>
              </div>
            </div>
          )}

          {/* ── LIBRARY TAB ───────────────────────────────── */}
          {activeTab === 'library' && (
            <div className="tab-panel" key="library">
              {isLoadingLib ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <span className="spinner" style={{ width: 24, height: 24 }} />
                </div>
              ) : games.length === 0 ? (
                <div className="card" style={{ textAlign: 'center' }}>
                  <div className="card-desc" style={{ margin: 0 }}>
                    No games installed via SafeSteamTools yet.<br />
                    Use the <strong>Fetch</strong> or <strong>Files</strong> tab to add games.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{games.length} game{games.length !== 1 ? 's' : ''} installed</span>
                    <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.7rem' }} onClick={loadLibrary}>
                      Refresh
                    </button>
                  </div>
                  {games.map((game, i) => (
                    <div
                      className="card"
                      key={game.luaFile}
                      style={{ animationDelay: `${i * 0.06}s` }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="card-title" style={{ marginBottom: 2 }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-cyan)' }}>
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {game.gameName}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {game.appId && <span>AppID: {game.appId}</span>}
                            <span>{game.depotIds.length} depot{game.depotIds.length !== 1 ? 's' : ''}</span>
                            <span>{game.manifestCount} manifest{game.manifestCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: '0.7rem', flexShrink: 0 }}
                          onClick={() => handleRemoveGame(game)}
                          title="Remove this game's files"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Status Toast ──────────────────────────────── */}
          {statusMsg && (
            <div className={`status-toast ${statusType}`} key={statusMsg}>
              {statusType === 'info' && <span className="spinner" />}
              {statusMsg}
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="bottom-bar">
          <button onClick={handleAutoPatch} disabled={!steamPath} className="btn btn-primary">
            Auto-Patch
          </button>
          <button onClick={handleRestart} disabled={!steamPath} className="btn btn-secondary">
            Restart Steam
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
