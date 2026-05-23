export {};

interface InstalledGame {
  luaFile: string;
  appId: string | null;
  gameName: string;
  depotIds: string[];
  manifestCount: number;
  fileSize: number;
}

declare global {
  interface Window {
    api: {
      closeApp: () => void;
      selectDirectory: () => Promise<string | null>;
      searchGame: (term: string) => Promise<{ success: boolean; results: { id: string, name: string }[] }>;
      getFilePath: (file: File) => string;
      getSteamPath: () => Promise<string | null>;
      autoPatch: (steamPath: string) => Promise<{ success: boolean; message: string }>;
      installMods: (steamPath: string, files: {name: string, path: string}[]) => Promise<{ success: boolean; message: string }>;
      installOnlineFix: (steamPath: string, appId: string, zipPath: string) => Promise<{ success: boolean; message: string }>;
      downloadManifests: (steamPath: string, appid: string, dlcs: string[]) => Promise<{ success: boolean; message: string }>;
      lookupAppId: (appid: string) => Promise<{ success: boolean; name: string | null; dlcs: string[] }>;
      listInstalled: (steamPath: string) => Promise<InstalledGame[]>;
      removeGame: (steamPath: string, luaFile: string, depotIds: string[]) => Promise<{ success: boolean; message: string }>;
      restartSteam: (steamPath: string) => Promise<{ success: boolean; message: string }>;
      onPatchStatus: (callback: (msg: string) => void) => void;
      onDownloadStatus: (callback: (msg: string) => void) => void;
    };
  }
}
