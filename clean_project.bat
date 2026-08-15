@echo off
setlocal
title WuWa Cutscene Studio - Clean Project
echo ===================================================
echo   Cleaning Build Artifacts & Temporary Files
echo ===================================================
echo.

echo [1/4] Removing node_modules...
if exist "node_modules" rmdir /s /q "node_modules"

echo [2/4] Removing Rust target cache (src-tauri\target)...
if exist "src-tauri\target" rmdir /s /q "src-tauri\target"

echo [3/4] Removing Frontend dist folder...
if exist "dist" rmdir /s /q "dist"

echo [4/4] Removing temporary files & logs...
if exist "txtp" rmdir /s /q "txtp"
if exist "txtp_test" rmdir /s /q "txtp_test"
if exist "captions" rmdir /s /q "captions"
if exist "debug_wwiser.log" del /f /q "debug_wwiser.log"

echo.
echo ===================================================
echo  Clean complete! Project is lightweight for Git.
echo  Run 'run_app.bat' or 'npm install' to restart dev.
echo ===================================================
pause
