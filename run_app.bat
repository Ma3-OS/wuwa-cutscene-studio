@echo off
setlocal
title WuWa Cutscene Studio - Developer Mode
echo ===================================================
echo   WuWa Cutscene Studio - Launching App...
echo ===================================================
echo.

if not exist "node_modules" (
    echo Installing node dependencies (first-time run)...
    call npm install
    if errorlevel 1 (
        echo Error: npm install failed.
        pause
        exit /b 1
    )
)

echo Starting Tauri Dev Server...
call npm run tauri dev

if errorlevel 1 (
    echo.
    echo App exited with an error.
    pause
)
