@echo off
title Plant AI Platform - Automated Setup
echo ======================================================================
echo   Plant AI Platform - Otomatik Kurulum Sihirbazi
echo ======================================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Python bulunamadi! Lutfen Python 3.10+ yukleyip PATH'e ekleyin.
    pause
    exit /b 1
)
echo [OK] Python mevcut.

:: 2. Check Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Node.js bulunamadi! Lutfen Node.js v18+ yukleyin.
    pause
    exit /b 1
)
echo [OK] Node.js mevcut.
echo.

:: 3. Setup Backend
echo ----------------------------------------------------------------------
echo   1/2 Backend Sanal Ortam ve Bagimliliklar Yukleniyor...
echo ----------------------------------------------------------------------
cd /d "%~dp0backend"

if not exist venv (
    echo Sanal ortam (venv) olusturuluyor...
    python -m venv venv
)

call venv\Scripts\activate

echo Python paketleri yukleniyor (requirements.txt)...
pip install -r requirements.txt

if not exist .env (
    if exist .env.example (
        echo .env dosyasi yoktu, .env.example kopyalaniyor...
        copy .env.example .env
        echo [BILGI] Lutfen backend/.env dosyasindaki veritabani ve API anahtarlarini duzenleyin!
    )
)

cd /d "%~dp0"

:: 4. Setup Mobile
echo.
echo ----------------------------------------------------------------------
echo   2/2 Mobile Expo Bagimliliklari Yukleniyor...
echo ----------------------------------------------------------------------
cd /d "%~dp0mobile"

if not exist node_modules (
    echo npm paketleri yukleniyor (npm install)...
    call npm install
) else (
    echo node_modules zaten mevcut. Paketler kontrol ediliyor...
    call npm install
)

cd /d "%~dp0"

echo.
echo ======================================================================
echo   [TEBRIKLER] Kurulum Tamamlandi!
echo ======================================================================
echo   Sistemi baslatmak icin:
echo   - Tek tikla hepsini baslat: run-all.bat
echo   - Sadece Backend:           run-backend.bat
echo   - Sadece Mobile:            run-mobile.bat
echo ======================================================================
echo.
pause
