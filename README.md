
# SafeSteamTools

![cpp](https://img.shields.io/badge/cpp-20%2B-green?logo=cplusplus)
![CMake](https://img.shields.io/badge/CMake-3.20%2B-green?logo=cmake)
![OnlyWindows](https://img.shields.io/badge/windows%20only-red?style=for-the-badge)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/OpenSteam001/OpenSteamTool)

OpenSteamTool is a Windows DLL project built with CMake.

## Feature

### Core Unlocks
- Unlock an unlimited number of unowned games.
- Unlock all DLCs for unowned games.
- Support auto load depot decryption keys from Lua config.
- Support auto manifest download via `steamrun` / `wudrm` upstream APIs(default is `wudrm`), or a custom Lua endpoint (see [Manifest via Lua](#manifest-via-lua)).
- Support downloading protected games or DLCs that require an access token.
- Support binding manifest to prevent specific games from being updated.

### Hot Reload
- Adding, modifying, deleting, or overwriting `.lua` files in any watched directory automatically triggers a reload. No restart, no offline/online toggle needed.

### Family Sharing and Remote Play
- Bypass Steam Family Sharing restrictions, allowing shared games to be played without limitations.

### Compatible with games protected by Denuvo and SteamStub
- For AppTicket and ETicket: in `HKEY_CURRENT_USER\Software\Valve\Steam\Apps\{AppId}`, both `AppTicket` and `ETicket` are `REG_BINARY` values.
- Use `setAppTicket(appid, "hex")` and `setETicket(appid, "hex")` in Lua config to write these values to the registry automatically.
- SteamID priority: read `SteamID` as `REG_SZ` (numeric-only) first; if missing, parse from `AppTicket`.

### Stats and Achievements
- Enable stats and achievements for unowned games.
- Uses `setStat(appid, "steamid")` to configure which SteamID's achievement data to pull.
- If no `setStat` is configured for an app, falls back to the hardcoded default SteamID `76561198028121353`.

### Online Fix
- Add `-onlinefix` to the Steam launch parameters to enable 480-based online play in games that use lobby matchmaking. The current limitation is that only one such game can run at a time.To revert, simply remove -onlinefix from the launch parameters — online play returns to normal on the next launch.

## Future
- For games protected by Denuvo and SteamStub, find a safe timing to switch `GetSteamID` (see `src/Hook/Hooks_IPC.cpp#Handler_IClientUser_GetSteamID` TODO) so save files are not affected.(**Suggestions welcome — when is the earliest point after game initialization that we can safely switch the
  SteamID without affecting save file binding?**)
- Steam Cloud synchronization support.(This is a huge project)
- Add Auto Denuvo Authorization Sharing for Legitimate Accounts.

## Usage
1. Run `build.bat` from the project root to build the project.
2. Copy generated `dwmapi.dll`, `xinput1_4.dll` and `OpenSteamTool.dll` to the Steam root directory.
3. Create Lua directory (for example `C:\steam\config\lua`) and place Lua scripts there. The DLL will automatically load and execute them.
4. Lua example:
```lua
addappid(1361510) -- unlock game with appid 1361510

addappid(1361511, 0,"5954562e7f5260400040a818bc29b60b335bb690066ff767e20d145a3b6b4af0") -- unlock game with appid 1361511 depotKey is "5954562e7f5260400040a818bc29b60b335bb690066ff767e20d145a3b6b4af0" 

addtoken(1361510,"2764735786934684318") -- add access token ("2764735786934684318

