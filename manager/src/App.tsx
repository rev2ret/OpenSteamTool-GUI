import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [lookedUpName, setLookedUpName] = useState<string | null>(null);
  const [lookedUpDlcs, setLookedUpDlcs] = useState<string[]>([]);
  const [includeDlcs, setIncludeDlcs] = useState(true);
  const [isLooking, setIsLooking] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Files
  const [isDragging, setIsDragging] = useState(false);

  // Library
  const [games, setGames] = useState<InstalledGame[]>([]);
  const [isLoadingLib, setIsLoadingLib] = useState(false);
  const [gameNames, setGameNames] = useState<Record<string, string>>({});

  const showStatus = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusMsg(msg);
    setStatusType(type);
  };

  const loadLibrary = useCallback(async () => {
    if (!steamPath) return;
    setIsLoadingLib(true);
    const list: InstalledGame[] = (await window.api.listInstalled(steamPath)) || [];
    setGames(list);

    // Resolve game names from Steam for any that have an appId
    const namesToResolve = list.filter(g => g.appId && !gameNames[g.appId]);
    for (const g of namesToResolve) {
      if (!g.appId) continue;
      const result = await window.api.lookupAppId(g.appId);
      if (result.success && result.name) {
        setGameNames(prev => ({ ...prev, [g.appId!]: result.name! }));
      }
    }

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

  // Auto-lookup game name when AppID changes
  useEffect(() => {
    setLookedUpName(null);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    if (!appId.match(/^\d{3,}$/)) return; // need at least 3 digits

    setIsLooking(true);
    lookupTimer.current = setTimeout(async () => {
      const result = await window.api.lookupAppId(appId);
      if (result.success && result.name) {
        setLookedUpName(result.name);
        setLookedUpDlcs(result.dlcs || []);
      } else {
        setLookedUpName(null);
        setLookedUpDlcs([]);
      }
      setIsLooking(false);
    }, 500);

    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [appId]);

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
    if (!appId.match(/^\d+$/)) { showStatus('AppID must be numeric.', 'error'); return; }

    setIsFetching(true);
    showStatus(`Fetching ${lookedUpName || appId}...`, 'info');
    const dlcsToFetch = (includeDlcs && lookedUpDlcs) ? lookedUpDlcs : [];
    const result = await window.api.downloadManifests(steamPath, appId, dlcsToFetch);
    showStatus(result.message, result.success ? 'success' : 'error');
    if (result.success) { 
      setAppId(''); 
      setLookedUpName(null); 
      setLookedUpDlcs([]);
    }
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
    const displayName = (game.appId && gameNames[game.appId]) || game.gameName;
    showStatus(`Removing ${displayName}...`, 'info');
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
        </div>

        {/* Header */}
        <div className="header">
          <div className="header-logo">SafeSteamTools</div>
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
                  Enter a Steam AppID to instantly download and install manifests.
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

                {/* Game name preview */}
                {appId.match(/^\d{3,}$/) && (
                  <div className="game-preview">
                    {isLooking ? (
                      <><span className="spinner" /> Looking up...</>
                    ) : lookedUpName ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="game-preview-dot success" />
                          <span style={{ fontWeight: 600 }}>{lookedUpName}</span>
                          {lookedUpDlcs && lookedUpDlcs.length > 0 && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', fontSize: '0.85rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <input 
                                type="checkbox" 
                                checked={includeDlcs} 
                                onChange={(e) => setIncludeDlcs(e.target.checked)}
                                style={{ margin: 0, accentColor: 'var(--accent-cyan)' }}
                              />
                              Include {lookedUpDlcs.length} DLC{lookedUpDlcs.length !== 1 ? 's' : ''}
                            </label>
                          )}
                        </div>
                      </>
                    ) : (
                      <><span className="game-preview-dot error" />Game not found</>
                    )}
                  </div>
                )}
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
                  <div className="library-header">
                    <span>{games.length} game{games.length !== 1 ? 's' : ''} installed</span>
                    <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.7rem' }} onClick={loadLibrary}>
                      Refresh
                    </button>
                  </div>
                  {games.map((game, i) => {
                    const displayName = (game.appId && gameNames[game.appId]) || game.gameName;
                    return (
                      <div className="card game-card" key={game.luaFile} style={{ animationDelay: `${i * 0.06}s` }}>
                        <div className="game-card-row">
                          <div className="game-card-info">
                            <div className="card-title" style={{ marginBottom: 2 }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-cyan)' }}>
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              <span className="game-name">{displayName}</span>
                            </div>
                            <div className="game-meta">
                              {game.appId && <span>AppID: {game.appId}</span>}
                              <span>{game.depotIds.length} depot{game.depotIds.length !== 1 ? 's' : ''}</span>
                              <span>{game.manifestCount} manifest{game.manifestCount !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '0.7rem', flexShrink: 0 }}
                            onClick={() => handleRemoveGame(game)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
          {activeTab !== 'fetcher' && (
            <button onClick={handleAutoPatch} disabled={!steamPath} className="btn btn-primary">
              Auto-Patch
            </button>
          )}
          <button onClick={handleRestart} disabled={!steamPath} className="btn btn-secondary" style={{ marginLeft: activeTab === 'fetcher' ? 'auto' : 0 }}>
            Restart Steam
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
