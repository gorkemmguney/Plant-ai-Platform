# Plant AI Platform — Yapay Zeka Destekli Bitki Bakım ve E-Ticaret Asistanı

Plant AI Platform; kullanıcıların bitki satın alabildiği, siparişlerini takip
edebildiği ve bitki sağlığını **fotoğrafla analiz ettirip** yapay zeka ile
sohbet edebildiği uçtan uca bir mobil platformdur. Backend FastAPI (Python),
istemci ise Expo / React Native (TypeScript) ile geliştirilmiştir.

---

## 1. Temel Fonksiyonlar

- **Görsel Bitki Analizi:** Kullanıcı bitkisinin fotoğrafını yükler; Google
  Gemini Vision modeli görüntüyü analiz ederek sağlık durumu ve bakım önerileri
  üretir (`POST /ai/analyze-image`).
- **Yapay Zeka Sohbet:** Bitki bakımı hakkında doğal dilde soru-cevap; sohbet
  geçmişini koruyan bir Gemini sohbet akışı (`POST /ai/chat`, `POST /ai/feedback`).
- **Sipariş ve Ürün Yönetimi:** Ürün kataloğu, sipariş oluşturma, kendi
  siparişlerini listeleme ve sipariş durumu güncelleme
  (`/catalog/products`, `/orders`).
- **Bildirimler:** Sipariş durumu değiştiğinde otomatik bildirim üretimi;
  bildirimleri listeleme ve okundu işaretleme (`/notifications`).
- **Rol Bazlı Yetkilendirme:** Firebase kimlik doğrulaması üzerine `admin`,
  `seller` ve `customer` rolleri; mobil tarafta role göre farklı navigasyon.

---

## 2. Sistem Mimarisi

| Katman | Teknoloji |
|--------|-----------|
| **İstemci (Mobile)** | Expo / React Native (TypeScript), React Navigation |
| **Backend** | FastAPI (Python), SQLAlchemy (async), Alembic |
| **Veri Tabanı** | PostgreSQL (app_user, cust, prod, cust_ord, ai_chat vb.) |
| **Kimlik & Depolama** | Firebase Authentication, Firebase Storage, Firebase Cloud Messaging |
| **Yapay Zeka Katmanı** | Google Gemini API (Vision + Chat) |
| **Yetkilendirme** | Firebase ID token doğrulama + rol bazlı erişim (admin / seller / customer) |

**İstek akışı:** Mobile → Firebase ID token → `Authorization: Bearer <token>` →
`get_current_user` (token doğrulama + `app_user` senkronu) → `require_role(...)`
→ router → service → repository/model → PostgreSQL.

---

## 3. Kullanıcı Senaryoları

- **Görsel Analiz:** Kullanıcı solmuş bir bitkinin fotoğrafını yükler; sistem
  olası nedenleri ve bakım adımlarını döndürür.
- **Operasyonel İşlem:** "Siparişlerimi göster" veya yeni sipariş oluşturma;
  satıcı/yönetici sipariş durumunu günceller.
- **Proaktif Bildirim:** Sipariş durumu değiştiğinde müşteriye otomatik
  bildirim düşer.

---

## 4. Proje Yapısı

Uygulama `plant-ai-platform` deposunda iki ana bölümden oluşur: FastAPI tabanlı
**backend** ve Expo (React Native / TypeScript) tabanlı **mobile** istemci.

```
plant-ai-platform/
├── backend/                    # FastAPI + PostgreSQL + Firebase + Gemini
│   ├── app/
│   │   ├── core/               # config, firebase, security (RBAC), storage
│   │   ├── db/                 # session, base
│   │   ├── models/             # SQLAlchemy modelleri (mevcut DB şemasıyla birebir)
│   │   ├── schemas/            # Pydantic request/response şemaları
│   │   ├── services/           # iş mantığı (order, ai, notification, customer)
│   │   ├── routers/            # /auth /admin /catalog /orders /ai /notifications /customers
│   │   ├── repositories/       # veri erişim katmanı
│   │   ├── rbac/               # rol sabitleri (admin/seller/customer)
│   │   └── main.py             # FastAPI uygulama girişi
│   ├── alembic/                # veritabanı migration'ları
│   ├── requirements.txt
│   └── README.md               # backend kurulum ve mimari notları
│
├── mobile/                     # Expo / React Native (TypeScript)
│   ├── src/
│   │   ├── context/            # AuthContext (oturum durumu)
│   │   ├── firebase/           # Firebase JS SDK yapılandırması
│   │   ├── navigation/         # rol bazlı stack'ler (Admin/Seller/Customer + Root)
│   │   ├── screens/            # ekranlar (auth/Login, Home)
│   │   └── services/           # apiClient (backend ile iletişim)
│   ├── App.tsx
│   ├── app.json
│   └── package.json
│
├── README.md                   # Bu dosya (proje genel tanımı)
└── TODO.md                     # Görev / yapılacaklar listesi
```

---

## 5. API Uç Noktaları (özet)

| Yöntem | Yol | Açıklama |
|--------|-----|----------|
| GET | `/auth/me` | Firebase token doğrula + `app_user` senkronu |
| POST | `/admin/assign-role` | Kullanıcıya rol atama (admin) |
| GET/POST | `/catalog/products` | Ürünleri listele / oluştur |
| GET/PATCH/DELETE | `/catalog/products/{id}` | Ürün detay / güncelle / sil |
| POST/GET | `/orders` | Sipariş oluştur / kendi siparişlerini listele |
| PATCH | `/orders/{id}/status` | Sipariş durumu güncelle (+ otomatik bildirim) |
| POST | `/ai/analyze-image` | Bitki fotoğrafı analizi (Gemini Vision) |
| POST | `/ai/chat` | Yapay zeka sohbet |
| POST | `/ai/feedback` | Sohbet geri bildirimi |
| GET | `/notifications` | Bildirimleri listele |
| POST | `/notifications/{id}/read` | Bildirimi okundu işaretle |
| POST/GET | `/customers/me` | Müşteri profili oluştur / getir |

Swagger dokümantasyonu: `http://localhost:8000/docs`

---

## 6. Başlangıç (Getting Started)

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # DATABASE_URL, FIREBASE_CREDENTIALS_PATH, GEMINI_API_KEY doldurun
alembic upgrade head            # veritabanı migration'ları
uvicorn app.main:app --reload
```

Ayrıntılı kurulum ve mimari notları için `backend/README.md` dosyasına bakın.

### Mobile (Expo / React Native)

```bash
cd mobile
npm install
npx expo start
```

`src/firebase/firebaseConfig.ts` içindeki Firebase yapılandırmasını ve
`src/services/apiClient.ts` içindeki backend adresini kendi ortamınıza göre
ayarlayın.

---

## 7. Yol Haritası (Roadmap)

- **Faz 1:** Kimlik doğrulama (Firebase) ve rol bazlı navigasyon — **tamamlandı**.
- **Faz 2:** Ürün kataloğu, sipariş ve müşteri modellemesi — **tamamlandı**.
- **Faz 3:** Yapay zeka görsel analiz + sohbet (Gemini) — **tamamlandı**.
- **Faz 4:** Bildirim sistemi (sipariş durumu → otomatik bildirim) — **tamamlandı**.
- **Sonraki:** FCM push bildirimleri, kapsam dışı tabloların (favori/etkileşim,
  zamanlanmış kampanya işleri) router/service katmanı, testler.
