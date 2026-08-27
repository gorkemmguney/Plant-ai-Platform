@echo off
title Plant AI Platform - Master Runner
echo ======================================================================
echo   Plant AI Platform - Backend & Mobile Baslatiliyor...
echo ======================================================================
echo.

:: 1. Start Backend in a new window
echo Backend sunucusu yeni pencerede baslatiliyor...
start "Plant AI Backend" cmd /c "%~dp0run-backend.bat"

:: 2. Wait 2 seconds
timeout /t 2 /nobreak >nul

:: 3. Start Mobile in a new window
echo Mobile Expo uygulamasi yeni pencerede baslatiliyor...
start "Plant AI Mobile" cmd /c "%~dp0run-mobile.bat"

echo.
echo [TAMAM] Hem Backend hem Mobile baslatildi.
echo Backend Swagger UI: http://localhost:8000/docs
echo Mobile Expo CLI: Yeni acilan penceredeki QR kodu okutabilirsiniz.
echo.
pause
