@echo off
setlocal
title WuWa Cutscene Studio - Build Release
echo ===================================================
echo   WuWa Cutscene Studio - Production Build
echo ===================================================
echo.

if not exist "node_modules" (
    echo [1/2] Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo Error: npm install failed.
        pause
        exit /b 1
    )
)

echo [2/2] Building Standalone Release (.exe)...
call npm run tauri build

if errorlevel 1 (
    echo.
    echo Error: Build failed. Please check the logs above.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo  Build Finished Successfully!
echo  Release executable location:
echo  - src-tauri\target\release\WuWa Cutscene Studio.exe
echo  - src-tauri\target\release\bundle\
echo ===================================================
pause
