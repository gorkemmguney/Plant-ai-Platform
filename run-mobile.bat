@echo off
title Plant AI - Mobile Runner
echo ==================================================
echo   Starting Plant AI Mobile Application (Expo)
echo ==================================================
cd /d "%~dp0mobile"

if not exist node_modules (
    echo node_modules bulunamadi. Paketler yukleniyor...
    call npm install
)

echo Expo baslatiliyor...
call npx.cmd expo start
pause
