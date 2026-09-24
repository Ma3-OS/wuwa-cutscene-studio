@echo off
setlocal
title WuWa Cutscene Studio - Launcher
echo ===================================================
echo   Starting WuWa Cutscene Studio (Dev Mode)
echo ===================================================
echo.

if not exist "node_modules" (
    echo [1/2] Installing dependencies first...
    call npm install
    if errorlevel 1 (
        echo Error: npm install failed.
        pause
        exit /b 1
    )
)

echo [2/2] Launching Tauri Desktop App...
call npm run tauri:dev

if errorlevel 1 (
    echo.
    echo Application exited with an error.
    pause
)
