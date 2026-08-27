# Mobile Mimarisi (React Native & Expo)

Bu doküman, `backend/` klasöründeki FastAPI servisine bağlanan React Native (Expo) uygulamasının klasör yapısını ve Supabase Auth akışını tanımlar.

## Klasör Yapısı

```
mobile/
  src/
    services/
      apiClient.ts          # Axios istemcisi, API istekleri
    lib/
      supabaseClient.ts     # Supabase Auth istemcisi
    context/
      AuthContext.tsx       # Supabase Auth durumu ve kullanıcı rolleri
    navigation/
      RootNavigator.tsx     # Rol bazlı yönlendirme (Admin/Seller/Customer stack)
    screens/
      auth/                 # Login, Register, Forgot Password
      customer/             # Müşteri ekranları (Bitki pazarı, Sepet, AI Teşhis, Bahçem)
      seller/               # Satıcı paneli ve ürün yönetimi
      admin/                # Sistem yönetim ekranları
      shared/               # Ortak profil ve ayarlar
    components/             # Paylaşılan UI bileşenleri
```

## Kimlik Doğrulama Akışı (Supabase Auth)

1. `mobile/src/lib/supabaseClient.ts` dosyası `@supabase/supabase-js` istemcisini başlatır.
2. `AuthContext.tsx` oturum değişikliklerini anlık dinler (`supabase.auth.onAuthStateChange`).
3. Giriş başarılı olduğunda Supabase oturum token'ı ile backend'e `GET /auth/me` isteği atılarak kullanıcı rolleri (Admin, Seller, Customer) yüklenir.
4. `RootNavigator`, aktif role göre ilgili ekran dizilimini (`CustomerStack`, `SellerStack` veya `AdminStack`) render eder.
