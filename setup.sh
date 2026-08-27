#!/usr/bin/env bash

echo "======================================================================"
echo "  Plant AI Platform - Otomatik Kurulum Sihirbazı (Linux / macOS)"
echo "======================================================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[HATA] python3 bulunamadı! Lütfen Python 3.10+ yükleyin."
    exit 1
fi
echo "[OK] Python3 mevcut."

# Check Node
if ! command -v node &> /dev/null; then
    echo "[HATA] Node.js bulunamadı! Lütfen Node.js v18+ yükleyin."
    exit 1
fi
echo "[OK] Node.js mevcut."
echo ""

# Backend Setup
echo "----------------------------------------------------------------------"
echo "  1/2 Backend Sanal Ortam ve Bağımlılıklar Yükleniyor..."
echo "----------------------------------------------------------------------"
cd "$(dirname "$0")/backend"

if [ ! -d "venv" ]; then
    echo "Sanal ortam (venv) oluşturuluyor..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Python paketleri yükleniyor..."
pip install -r requirements.txt

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo ".env kopyalanıyor..."
        cp .env.example .env
        echo "[BİLGİ] Lütfen backend/.env dosyasını kendi bilgilerinize göre düzenleyin."
    fi
fi

cd "$(dirname "$0")"

# Mobile Setup
echo ""
echo "----------------------------------------------------------------------"
echo "  2/2 Mobile Expo Bağımlılıkları Yükleniyor..."
echo "----------------------------------------------------------------------"
cd "$(dirname "$0")/mobile"

if [ ! -d "node_modules" ]; then
    echo "npm paketleri yükleniyor (npm install)..."
    npm install
else
    echo "node_modules mevcut. Kontrol ediliyor..."
    npm install
fi

cd "$(dirname "$0")"

echo ""
echo "======================================================================"
echo "  [TEBRİKLER] Kurulum Tamamlandı!"
echo "======================================================================"
echo "  Backend çalıştırmak için: cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
echo "  Mobile çalıştırmak için:  cd mobile && npx expo start"
echo "======================================================================"
