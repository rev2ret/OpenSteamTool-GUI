@echo off
setlocal EnableDelayedExpansion

REM Always run from the script directory.
cd /d "%~dp0"

REM ---------------------------------------------------------------------------
REM Configurable build options
REM   GENERATOR  - CMake generator (default: auto-detect)
REM   ARCH       - Architecture for multi-config generators (default: x64)
REM   CONFIGS    - Configurations to build (default: Release)
REM ---------------------------------------------------------------------------
if "%GENERATOR%"=="" (
    where ninja >nul 2>nul
    if not errorlevel 1 (
        set "GENERATOR=Ninja Multi-Config"
    ) else (
        where gcc >nul 2>nul
        if not errorlevel 1 (
            set "GENERATOR=MSYS Makefiles"
        ) else (
            set "GENERATOR=Visual Studio 17 2022"
        )
    )
)

if "%ARCH%"=="" set "ARCH=x64"
if "%CONFIGS%"=="" (
    if "%GENERATOR%"=="MSYS Makefiles" (
        set "CONFIGS=Release"
    ) else if "%GENERATOR%"=="MinGW Makefiles" (
        set "CONFIGS=Release"
    ) else (
        set "CONFIGS=Release Debug"
    )
)

echo [INFO] Configuring with generator: %GENERATOR%
if "%GENERATOR%"=="MSYS Makefiles" (
    cmake -S src -B build -G "MSYS Makefiles" -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_COMPILER=C:/msys64/ucrt64/bin/g++.exe -DCMAKE_C_COMPILER=C:/msys64/ucrt64/bin/gcc.exe -DCMAKE_MAKE_PROGRAM=C:/msys64/usr/bin/make.exe
) else if "%GENERATOR%"=="MinGW Makefiles" (
    cmake -S src -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_COMPILER=C:/msys64/ucrt64/bin/g++.exe -DCMAKE_C_COMPILER=C:/msys64/ucrt64/bin/gcc.exe
) else (
    echo "%GENERATOR%" | findstr /I /C:"Visual Studio" >nul
    if not errorlevel 1 (
        cmake -S src -B build -G "%GENERATOR%" -A %ARCH%
    ) else (
        cmake -S src -B build -G "%GENERATOR%"
    )
)
if errorlevel 1 goto :fail

for %%C in (%CONFIGS%) do (
    echo [INFO] Building: %%C
    if "%GENERATOR%"=="MSYS Makefiles" (
        cmake --build build --parallel
    ) else if "%GENERATOR%"=="MinGW Makefiles" (
        cmake --build build --parallel
    ) else (
        cmake --build build --config %%C --parallel
    )
    if errorlevel 1 goto :fail
)

REM Copy built DLLs to a unified dlls/ folder in the project root
mkdir "%~dp0dlls" 2>nul
set "OUT_DIR="
if exist "%~dp0build\Release\OpenSteamTool.dll" set "OUT_DIR=%~dp0build\Release"
if exist "%~dp0build\Debug\OpenSteamTool.dll" set "OUT_DIR=%~dp0build\Debug"
if exist "%~dp0build\OpenSteamTool.dll" set "OUT_DIR=%~dp0build"

if not "%OUT_DIR%"=="" (
    copy /y "%OUT_DIR%\OpenSteamTool.dll" "%~dp0dlls\" >nul
    copy /y "%OUT_DIR%\dwmapi.dll" "%~dp0dlls\" >nul
    copy /y "%OUT_DIR%\xinput1_4.dll" "%~dp0dlls\" >nul
    echo [INFO] DLLs successfully copied to "%~dp0dlls"
) else (
    echo [ERROR] Built DLLs not found in output directory.
    goto :fail
)

echo [OK] Build completed successfully.
exit /b 0

:fail
echo [ERROR] Build failed.
exit /b 1
