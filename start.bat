@echo off
setlocal
cd /d "%~dp0"
title Merlin v2.0 - Launcher
color 0B

echo.
echo ========================================
echo          Merlin v2.0 - Electron
echo ========================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detected
echo.

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed or is not available in PATH.
    echo.
    pause
    exit /b 1
)

echo [INFO] Checking Node.js dependencies...
call npm install --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Dependency installation failed!
    pause
    exit /b 1
)
echo [OK] Dependencies are ready
echo.

if not exist "assets\dlls\LumaCore.dll" (
    echo [ERROR] assets\dlls\LumaCore.dll was not found.
    echo Run npm run build:lumacore after installing CMake and VS Build Tools.
    pause
    exit /b 1
)
if not exist "assets\dlls\dwmapi.dll" (
    echo [ERROR] assets\dlls\dwmapi.dll was not found.
    echo Run npm run build:lumacore after installing CMake and VS Build Tools.
    pause
    exit /b 1
)

echo [INFO] Starting Merlin...
echo.

call npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application failed to start!
    pause
    exit /b 1
)

exit /b 0
