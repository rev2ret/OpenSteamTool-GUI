import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';

type Tab = 'fetcher' | 'files' | 'library' | 'fixes';

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
  const [searchResults, setSearchResults] = useState<{id: string, name: string}[]>([]);
  const [includeDlcs, setIncludeDlcs] = useState(true);
  const [isLooking, setIsLooking] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fixes
  const [selectedFixAppId, setSelectedFixAppId] = useState('');
  const [isFixDragging, setIsFixDragging] = useState(false);

  // Files
  const [isDragging, setIsDragging] = useState(false);

  // Library
  const [games, setGames] = useState<InstalledGame[]>([]);
  const [steamApps, setSteamApps] = useState<{appId: string, name: string}[]>([]);
  const [isLoadingLib, setIsLoadingLib] = useState(false);
  const [gameNames, setGameNames] = useState<Record<string, string>>({});

  const showStatus = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusMsg(msg);
    setStatusType(type);
  };

  const loadLibrary = useCallback(async () => {
    if (!steamPath) return;
    setIsLoadingLib(true);
    
    // Load SafeSteamTools lua games
    const installed = await window.api.listInstalled(steamPath);
    setGames(installed || []);

    // Load ALL actual steam games from libraryfolders.vdf
    if (window.api.listSteamApps) {
      const apps = await window.api.listSteamApps(steamPath);
      setSteamApps(apps || []);
    }

    const namesToResolve = installed.filter(g => g.appId && !gameNames[g.appId]);
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

  // Auto-lookup game name or search when input changes
  useEffect(() => {
    setLookedUpName(null);
    setLookedUpDlcs([]);
    setSearchResults([]);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    const trimmed = appId.trim();
    if (!trimmed) return;

    if (trimmed.match(/^\d+$/)) {
      if (trimmed.length < 3) return; // Need at least 3 digits for an AppID
      setIsLooking(true);
      lookupTimer.current = setTimeout(async () => {
        const result = await window.api.lookupAppId(trimmed);
        if (result.success && result.name) {
          setLookedUpName(result.name);
          setLookedUpDlcs(result.dlcs || []);
        } else {
          setLookedUpName(null);
          setLookedUpDlcs([]);
        }
        setIsLooking(false);
      }, 500);
    } else {
      setIsLooking(true);
      lookupTimer.current = setTimeout(async () => {
        if (window.api.searchGame) {
          const result = await window.api.searchGame(trimmed);
          if (result.success) {
            setSearchResults(result.results.slice(0, 5));
          }
        }
        setIsLooking(false);
      }, 600);
    }

    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [appId]);

  // ── Handlers ──────────────────────────────────────────────
  
  const handleSelectSteamPath = async () => {
    if (window.api.selectDirectory) {
      const dir = await window.api.selectDirectory();
      if (dir) {
        setSteamPath(dir);
        showStatus('Steam path updated manually', 'success');
      }
    }
  };

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

  const IconFixes = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
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
            <div className="titlebar-dot red" onClick={() => window.api.closeApp && window.api.closeApp()} />
            <div className="titlebar-dot yellow" />
            <div className="titlebar-dot green" />
          </div>
        </div>

        {/* Header */}
        <div className="header">
          <div className="header-logo">SafeSteamTools</div>
        </div>

        {/* Steam Path */}
        <div className="steam-path-pill" onClick={handleSelectSteamPath} title="Click to manually select Steam folder">
          <div className={`dot ${steamPath ? 'connected' : 'disconnected'}`} />
          <span>{steamPath || 'Steam not found (Click to Browse)'}</span>
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
          <button className={`tab-btn ${activeTab === 'fixes' ? 'active' : ''}`} onClick={() => setActiveTab('fixes')}>
            {IconFixes} Fixes
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
                  Enter a Steam AppID or search by Game Name to download manifests.
                </div>

                <div className="input-row">
                  <input
                    type="text"
                    placeholder="AppID or Game Name..."
                    className="input-field"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (appId.match(/^\d+$/)) handleFetch();
                        else if (searchResults.length > 0) setAppId(searchResults[0].id);
                      }
                    }}
                  />
                  <button
                    onClick={handleFetch}
                    disabled={!appId.match(/^\d+$/) || isFetching}
                    className="btn btn-fetch"
                  >
                    {isFetching ? <span className="spinner" /> : 'Fetch'}
                  </button>
                </div>

                {/* Game name preview & Search Results */}
                {appId.trim() !== '' && (
                  <div className="game-preview" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    {isLooking ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="spinner" /> Searching...</div>
                    ) : appId.match(/^\d+$/) ? (
                      lookedUpName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
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
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="game-preview-dot error" />Game not found</div>
                      )
                    ) : (
                      searchResults.length > 0 ? (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Search Results:</div>
                          {searchResults.map((res) => (
                            <div 
                              key={res.id}
                              onClick={() => setAppId(res.id)}
                              style={{ 
                                padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', 
                                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.05)',
                                transition: 'background 0.2s'
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                              onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                            >
                              <span style={{ fontWeight: 500 }}>{res.name}</span>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{res.id}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="game-preview-dot error" />No results found</div>
                      )
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

          {/* ── FIXES TAB ─────────────────────────────────── */}
          {activeTab === 'fixes' && (
            <div className="tab-panel" key="fixes">
              <div className="card" style={{ paddingBottom: '1.5rem' }}>
                <div className="card-title">
                  {IconFixes} Apply Online Fix
                </div>
                <div className="card-desc">
                  Select a game and drop your <strong>.zip</strong> or <strong>.rar</strong> fix archive. SafeSteamTools will automatically extract it into the game's directory.
                </div>
                
                <div style={{ marginBottom: '1.2rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Target Game:</label>
                  <select 
                    className="input-field" 
                    style={{ cursor: 'pointer', appearance: 'auto' }}
                    value={selectedFixAppId}
                    onChange={(e) => setSelectedFixAppId(e.target.value)}
                  >
                    <option value="" disabled>Select a game...</option>
                    {steamApps.map(app => (
                      <option key={app.appId} value={app.appId}>
                        {app.name} ({app.appId})
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className={`drop-zone ${isFixDragging ? 'dragging' : ''}`}
                  style={{ opacity: selectedFixAppId ? 1 : 0.5, pointerEvents: selectedFixAppId ? 'auto' : 'none' }}
                  onDragOver={(e) => { e.preventDefault(); setIsFixDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsFixDragging(false); }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsFixDragging(false);
                    if (!steamPath || !selectedFixAppId) return;

                    const files = Array.from(e.dataTransfer.files);
                    const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip') || f.name.toLowerCase().endsWith('.rar') || f.name.toLowerCase().endsWith('.7z'));
                    
                    if (zipFile) {
                      const filePath = window.api.getFilePath(zipFile);
                      if (filePath && window.api.installOnlineFix) {
                        const targetApp = steamApps.find(a => a.appId === selectedFixAppId);
                        const displayName = targetApp ? targetApp.name : selectedFixAppId;
                        showStatus(`Installing fix for ${displayName}...`, 'info');
                        const res = await window.api.installOnlineFix(steamPath, selectedFixAppId, filePath);
                        showStatus(res.message, res.success ? 'success' : 'error');
                      }
                    } else {
                      showStatus('Please drop a valid .zip or .rar file!', 'error');
                    }
                  }}
                >
                  <div className="drop-content">
                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" strokeWidth="1.5" fill="none">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p>{selectedFixAppId ? <span>Drop <strong>.zip / .rar</strong> file here to install</span> : 'Please select a game first'}</p>
                  </div>
                </div>
              </div>
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
