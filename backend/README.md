# Plant AI Platform — Backend

FastAPI + PostgreSQL (mevcut DBeaver şemanız) + Firebase (Auth/Storage/FCM) + Google Gemini API.

## 1. Kurulum

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

`.env` dosyasını doldurun:
- `DATABASE_URL` → mevcut PostgreSQL bağlantınız
- `FIREBASE_CREDENTIALS_PATH` → Firebase Console > Project Settings > Service
  Accounts > Generate new private key ile indirdiğiniz JSON dosyasının yolu
- `GEMINI_API_KEY` → [Google AI Studio](https://aistudio.google.com/apikey) üzerinden ücretsiz alınır

## 2. Veritabanı şemasında gereken TEK ek değişiklik

Mevcut ERD'nizde `app_user` tablosunda Firebase kullanıcılarını eşlemek için
bir sütun yok. Firebase, kimlik doğrulamayı kendi tarafında yönetir ve her
kullanıcıya benzersiz bir `uid` verir — bunu SQL tarafında saklamamız gerekiyor:

```sql
ALTER TABLE app_user ADD COLUMN firebase_uid VARCHAR(128) UNIQUE;
```

Alternatif olarak Alembic ile migration üretebilirsiniz:

```bash
alembic revision --autogenerate -m "add firebase_uid to app_user"
alembic upgrade head
```

> Not: `alembic/env.py` mevcut modelleri (`app/models/`) referans alır ve
> DBeaver'daki tabloları BİREBİR isimlendirmeyle eşleştirir (`app_user`,
> `cust`, `prod`, `cust_ord`, `ai_chat` vb.). İlk `alembic upgrade head`
> çalıştırmadan önce mevcut tablolarınızla çakışmaması için
> `alembic stamp head` ile mevcut şemayı "taban" olarak işaretlemeniz önerilir.

## 3. Firebase Authentication kurulumu

1. [Firebase Console](https://console.firebase.google.com) → yeni proje oluşturun (veya mevcut varsa kullanın)
2. Authentication → Sign-in method:
   - **Email/Password**: etkinleştirin
   - **Microsoft**: etkinleştirin → Azure AD üzerinden bir **App Registration**
     oluşturup Client ID / Client Secret / Tenant bilgilerini Firebase'e girin
     (adım adım: Firebase docs → "Microsoft ile giriş yapma")
3. Storage → bucket'ı etkinleştirin (bitki görselleri için)
4. Cloud Messaging → sunucu anahtarını not edin (push bildirim için)

RN tarafı bu ayarları `@react-native-firebase` SDK'ları ile tüketir; backend
tarafında **hiçbir Microsoft-özel kod yazmanıza gerek yoktur** — Firebase Admin
SDK, hangi sağlayıcıyla giriş yapılmış olursa olsun aynı `verify_id_token`
fonksiyonuyla doğrular.

## 4. Çalıştırma

```bash
uvicorn app.main:app --reload
```

Swagger dokümantasyonu: `http://localhost:8000/docs`

## 5. Mimari

```
app/
  core/        # config, firebase, security (RBAC), storage
  db/          # session, base
  models/      # SQLAlchemy — DBeaver şemanızla birebir
  schemas/     # Pydantic request/response
  services/    # iş mantığı (order, ai/gemini, notification)
  routers/     # /auth /admin /catalog /orders /ai /notifications
  rbac/        # rol sabitleri (admin/seller/customer)
```

**İstek akışı:** RN → Firebase ID token → `Authorization: Bearer <token>` →
`get_current_user` (token doğrulama + app_user senkronu) →
`require_role(...)` (rol kontrolü) → router → service → repository/model → DB.

## 6. Kapsam dışı bırakılan tablolar (bir sonraki adım)

`prod_spec_srvc_spec`, `prod_spec_rsrc_spec`, `user_preference`, `gnl_tp`,
`bsn_inter*`, `sch_job` gibi tablolar için model dosyaları hazır
(`app/models/misc.py`, `service.py`) ancak henüz router/service katmanı
yazılmadı — aynı desen (`repository → service → router`) izlenerek
genişletilebilir. Hangi özellik önce lazım olursa (örn. favori/etkileşim
takibi, zamanlanmış kampanya işleri) onu birlikte ekleyelim.

## 7. Neden bu AI sağlayıcı?

Gemini API, kalıcı ve kredi kartı gerektirmeyen ücretsiz katmanı sayesinde
seçildi (bkz. proje sohbeti). `app/services/ai_service.py` içindeki
`analyze_plant_image` ve `chat_reply` fonksiyonları tek noktadan
değiştirilebilir tasarlandı — ileride farklı bir sağlayıcıya geçmek isterseniz
sadece bu dosya güncellenir, router/schema katmanları etkilenmez.
