export {};

declare global {
  interface Window {
    api: {
      getFilePath: (file: File) => string;
      getSteamPath: () => Promise<string | null>;
      autoPatch: (steamPath: string) => Promise<{ success: boolean; message: string }>;
      installMods: (steamPath: string, files: string[]) => Promise<{ success: boolean; message: string }>;
      restartSteam: (steamPath: string) => Promise<{ success: boolean; message: string }>;
      onPatchStatus: (callback: (msg: string) => void) => void;
    };
  }
}
