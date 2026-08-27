@echo off
title Plant AI - Backend Runner
echo ==================================================
echo   Starting Plant AI FastAPI Backend
echo ==================================================
cd /d "%~dp0backend"

if not exist venv (
    echo Python sanal ortami bulunamadi. Olusturuluyor...
    python -m venv venv
)

echo Sanal ortam aktif ediliyor...
call venv\Scripts\activate

echo Kutuphaneler yukleniyor (requirements.txt)...
pip install -r requirements.txt

echo.
echo [INFO] Eger veritabani degisikliklerini yansitmak isterseniz:
echo        alembic upgrade head
echo.

echo FastAPI sunucusu baslatiliyor (http://localhost:8000)...
uvicorn app.main:app --host 0.0.0.0 --reload
pause
