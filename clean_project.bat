@echo off
setlocal
title WuWa Cutscene Studio - Clean Project
echo ===================================================
echo   Cleaning Build Artifacts & Temporary Files
echo ===================================================
echo.

call npm run tauri:clean

echo.
echo ===================================================
echo  Clean complete! Project is lightweight for Git.
echo ===================================================
pause
