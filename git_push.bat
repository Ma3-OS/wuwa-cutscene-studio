@echo off
setlocal
title WuWa Cutscene Studio - Git Push
echo ===================================================
echo   WuWa Cutscene Studio - Git Push Tool
echo ===================================================
echo.

if not exist ".git" (
    echo [1/4] Initializing Git repository...
    git init
    git branch -M main
) else (
    echo [1/4] Git repository found.
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo.
    echo No remote GitHub URL configured!
    set /p repo_url="Enter your GitHub Repository URL (e.g. https://github.com/User/wuwa-cutscene-studio.git): "
    if not "%repo_url%"=="" (
        git remote add origin %repo_url%
    )
)

echo.
echo [2/4] Current Git status:
git status -s
echo.

set /p commit_msg="Enter commit message (Press Enter for 'Auto-update'): "
if "%commit_msg%"=="" set commit_msg=Auto-update

echo.
echo [3/4] Staging files...
git add .

echo.
echo [4/4] Committing changes...
git commit -m "%commit_msg%"

echo.
echo Pushing to GitHub (main branch)...
git push -u origin main

if errorlevel 1 (
    echo.
    echo Warning: 'git push' failed. Please check your GitHub credentials or remote URL.
) else (
    echo.
    echo ===================================================
    echo  Successfully pushed to GitHub!
    echo ===================================================
)

pause
