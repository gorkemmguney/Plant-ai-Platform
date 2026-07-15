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
- [x] Örnek/tohum (seed) verilerinin hazırlanması (`seed_data.sql`: roller, `gnl_st`, `sale_cnl`)
- [x] Tüm siparişleri listeleme (satıcı/admin) (`GET /orders/all`)

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

## Faz 5 — Mobil Arayüz (Expo)
- [x] Giriş/kayıt ekranı (`LoginScreen`)
- [x] Rol bazlı navigasyon iskeleti (Admin/Seller/Customer stack)
- [x] Ürün mağazası ekranı — müşteri (`MarketplaceScreen`, `/catalog/products` + satın al)
- [~] Sipariş oluşturma ve sipariş listesi ekranı (`/orders`) — satın alma var, müşteri sipariş listesi eksik
- [x] Sipariş durumu takip ekranı — satıcı görünümü (`OrdersScreen`, durum güncelleme)
- [ ] AI sohbet ekranı (`/ai/chat`)
- [ ] Kamera ile bitki fotoğrafı çekip analiz gönderme (`/ai/analyze-image`)
- [ ] Analiz sonucu görselleştirme ekranı
- [ ] Bildirim ekranı (`/notifications`, okundu işaretleme)
- [ ] Müşteri profili ekranı (`/customers/me`)

## Faz 6 — Rol Bazlı Paneller & Satıcı Onayı
### Backend
- [x] Kullanıcı listeleme (admin) — `GET /admin/users`
- [x] Kayıtta rol seçimi (müşteri/satıcı) — `POST /auth/select-role`
- [x] Satıcı onay durumu alanı — `app_user.seller_status` (`none/pending/verified/rejected`, Alembic migration)
- [x] Bekleyen satıcı başvuruları — `GET /admin/sellers/pending`
- [x] Satıcı onaylama — `POST /admin/verify-seller/{user_id}` (test edildi ✅ 200)
- [x] Satıcı reddetme — `POST /admin/reject-seller/{user_id}` (test edildi ✅ 200)
- [x] Rol kaldırma — `POST /admin/remove-role`
- [x] Eşzamanlı ilk-istek yarışına karşı `get_current_user` sağlamlaştırması
### Mobil
- [x] Admin paneli — Kullanıcılar (rol atama/kaldırma) + Onaylar (verify/reject) sekmeleri
- [x] Satıcı paneli — Ürünler (ekle/düzenle/sil) + Siparişler (durum) sekmeleri
- [x] Kayıt ekranında müşteri/satıcı seçimi + "onay bekliyor" bilgisi
- [x] Ayarlar'da satıcı başvuru durumu rozeti
- [ ] Uçtan uca doğrulama: kayıt(satıcı)→pending→admin onayı→seller paneli girişi

## Faz 7 — Müşteri Deneyimi (Customer UX)
### Alışveriş akışı
- [x] Sepete ekleme (Sepete Ekle → sepet ekranı → adet ayarı → tek siparişte çoklu ürün, `CartContext`)
- [x] "Siparişlerim" ekranı (müşteri kendi siparişleri, `GET /orders`, Ana Sayfa'dan erişim)
- [x] Siparişe tıklayınca içeriğini görme (ürün/adet/tutar, expand)
- [ ] Müşteri sipariş iptali ⚠️ backend gerekir (`POST /orders/{id}/cancel`; sadece erken aşamada, kendi siparişi) + mobilde "İptal Et" butonu
### Arama & keşif
- [x] Ürün arama (Mağaza'da işlevli arama çubuğu, client-side filtre)
- [x] Ana ekrandaki arama çubuğunu Mağaza'ya taşı — dokununca Mağaza'ya (arama ekranına) yönlendiriyor
- [x] Ana Sayfa'yı gerçek veriye bağla (sahte listeler yerine `/catalog/products`)
### Satıcılar / mağazalar (Trendyol tarzı)
- [ ] Alt bara "Mağazalar/Satıcılar" sekmesi — ürünleri satıcıya göre grupla ⚠️ backend gerekir (`prod`'a satıcı bağı)
- [ ] Aynı ürünü farklı satıcılardan gösterme + fiyat karşılaştırma ⚠️ backend gerekir (ürün eşleştirme)
### AI
- [ ] AI chat'te görsel yükleme (foto ekle → `/ai/analyze-image`) ⚠️ Görkem'in analiz işiyle koordine et
### Profil & bildirim
- [x] Ayarlar'da isim/soyisim görüntüle + düzenle (`PATCH /auth/me`, modal ile)
- [x] Bildirim ekranı (`GET /notifications` + okundu işaretleme, Ana Sayfa'dan erişim)

## Kapsam Dışı Tablolar (sonraki adım)
- [ ] `prod_spec_*`, `user_preference`, `bsn_inter*`, `sch_job` için router/service katmanı
  (modeller hazır; `repository → service → router` deseni izlenerek genişletilecek)

## Test & Kalite
- [ ] Birim testleri (backend servis/router)
- [ ] Entegrasyon testleri (uçtan uca senaryolar)
- [ ] Mobil UI testleri
- [~] API kimlik doğrulama ve rol kontrolü testleri (verify/reject-seller Swagger'dan manuel doğrulandı; otomatik test eksik)

## Dokümantasyon
- [x] API dokümantasyonu (Swagger/OpenAPI — `/docs`)
- [x] Backend kurulum ve mimari notları (`backend/README.md`)
- [ ] Mimari diyagramların hazırlanması
- [ ] Kullanıcı kılavuzu
