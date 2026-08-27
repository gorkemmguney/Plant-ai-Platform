# Plant AI Platform — Backend

FastAPI + PostgreSQL (Supabase Session Pooler) + Supabase Auth + Google Gemini AI + Resend Email API.

## 1. Kurulum

```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux / macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

`.env` dosyasını doldurun:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` → Supabase Database Session Pooler bilgileri
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` → Supabase API ayarları
- `RESEND_API_KEY` → [Resend](https://resend.com) API anahtarı
- `GEMINI_API_KEY` → [Google AI Studio](https://aistudio.google.com/apikey) API anahtarı

## 2. Veritabanı Migration ve Başlatma

```bash
# Tabloları oluştur
alembic upgrade head

# Demo ve lokasyon verilerini yükle
python seed_demo_data.py
python seed_locations.py
python seed_real_sellers.py

# Sunucuyu başlat
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Swagger dokümantasyonu: `http://localhost:8000/docs`  
ReDoc dokümantasyonu: `http://localhost:8000/redoc`

## 3. Mimari

```
app/
  core/        # config.py, supabase_auth.py, security
  db/          # session, base
  models/      # SQLAlchemy ORM modelleri
  schemas/     # Pydantic request/response şemaları
  services/    # İş mantığı (ai_service, contact_service)
  routers/     # /auth /admin /catalog /orders /ai /plants /contact
```
