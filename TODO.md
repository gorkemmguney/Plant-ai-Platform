# Plant AI Platform — Yapılacaklar Listesi (TODO)

Durum: `[ ]` yapılacak · `[~]` devam ediyor · `[x]` tamamlandı

---

## Faz 0 — Kurulum & Altyapı
- [x] Git deposu oluşturma
- [x] Proje klasör yapısının kurulması (backend / mobile)
- [x] Geliştirme ortamı (Python/FastAPI, Node/Expo, PostgreSQL) kurulumu
- [x] Ortam değişkenleri ve gizli anahtar yönetimi (.env, Firebase credentials)
- [ ] CI/CD boru hattının (pipeline) taslağının hazırlanması

## Faz 1 — Kimlik Doğrulama & Rol Yönetimi
- [x] Firebase Authentication entegrasyonu (backend Admin SDK + mobile JS SDK)
- [x] `app_user` senkronu (`GET /auth/me`) ve `firebase_uid` eşlemesi
- [x] Rol bazlı yetkilendirme (admin / seller / customer) — `require_role`
- [x] Rol atama uç noktası (`POST /admin/assign-role`)
- [x] Mobil tarafta rol bazlı navigasyon (Admin/Seller/Customer stack)
- [ ] Microsoft (Azure AD) ile giriş sağlayıcısının etkinleştirilmesi

## Faz 2 — Sipariş & Ürün Veritabanı
- [x] PostgreSQL şeması (app_user, cust, prod, cust_ord, ai_chat) — Alembic baseline
- [x] Ürün kataloğu CRUD (`/catalog/products`)
- [x] Sipariş oluşturma ve kendi siparişlerini listeleme (`/orders`)
- [x] Sipariş durumu güncelleme (`PATCH /orders/{id}/status`)
- [x] Müşteri profili uç noktaları (`/customers/me`)
- [ ] Örnek/tohum (seed) verilerinin hazırlanması

## Faz 3 — Yapay Zeka (Gemini)
- [x] Görsel bitki analizi (`POST /ai/analyze-image`, Gemini Vision)
- [x] Yapay zeka sohbet akışı (`POST /ai/chat`, geçmiş korunarak)
- [x] Sohbet geri bildirimi (`POST /ai/feedback`)
- [ ] Sipariş geçmişine göre kişiselleştirilmiş öneri motoru
- [ ] Analiz sonuçlarının mobil arayüzde görselleştirilmesi

## Faz 4 — Bildirim & Proaktif Takip
- [x] Sipariş durumu değişince otomatik bildirim üretimi
- [x] Bildirim listeleme ve okundu işaretleme (`/notifications`)
- [ ] Firebase Cloud Messaging ile push bildirim entegrasyonu
- [ ] Bitki bakım periyoduna göre proaktif hatırlatma kuralları

## Kapsam Dışı Tablolar (sonraki adım)
- [ ] `prod_spec_*`, `user_preference`, `bsn_inter*`, `sch_job` için router/service katmanı
  (modeller hazır; `repository → service → router` deseni izlenerek genişletilecek)

## Test & Kalite
- [ ] Birim testleri (backend servis/router)
- [ ] Entegrasyon testleri (uçtan uca senaryolar)
- [ ] Mobil UI testleri
- [ ] API kimlik doğrulama ve rol kontrolü testleri

## Dokümantasyon
- [x] API dokümantasyonu (Swagger/OpenAPI — `/docs`)
- [x] Backend kurulum ve mimari notları (`backend/README.md`)
- [ ] Mimari diyagramların hazırlanması
- [ ] Kullanıcı kılavuzu
