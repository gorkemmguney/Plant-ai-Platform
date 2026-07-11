# Mobile Mimarisi (React Native)

Bu doküman, `backend/` klasöründeki FastAPI servisine bağlanacak React Native
uygulamasının önerilen klasör yapısını ve auth akışını tanımlar.

## Klasör yapısı

```
mobile/
  src/
    api/
      client.ts            # axios instance, Firebase token interceptor
      auth.ts               # /auth/me çağrısı
      catalog.ts             # ürün listeleme/CRUD
      orders.ts              # sipariş oluşturma/listeleme
      ai.ts                   # görsel analiz + chat
    context/
      AuthContext.tsx        # Firebase auth state + rol bilgisi (global)
    navigation/
      RootNavigator.tsx       # rol bazlı yönlendirme (Admin/Seller/Customer stack)
      AdminStack.tsx
      SellerStack.tsx
      CustomerStack.tsx
      AuthStack.tsx            # login/register/microsoft-login ekranları
    screens/
      auth/
        LoginScreen.tsx
        RegisterScreen.tsx
      customer/
        HomeScreen.tsx           # ürün listesi
        ProductDetailScreen.tsx
        CartScreen.tsx
        AiChatScreen.tsx           # bitki bakım sohbeti
        AiImageAnalysisScreen.tsx  # kamera ile bitki tanıma
        OrdersScreen.tsx
      seller/
        MyProductsScreen.tsx
        ProductFormScreen.tsx
      admin/
        UserManagementScreen.tsx
    firebase/
      firebaseConfig.ts
    components/               # paylaşılan UI bileşenleri
```

## Auth akışı (email/şifre + Microsoft)

1. `firebaseConfig.ts` içinde `@react-native-firebase/app` ve
   `@react-native-firebase/auth` başlatılır.
2. **Email/şifre**: `auth().createUserWithEmailAndPassword(...)` /
   `signInWithEmailAndPassword(...)`.
3. **Microsoft girişi**: Firebase Console > Authentication > Sign-in method >
   Microsoft'u açtıktan sonra, RN tarafında `OAuthProvider('microsoft.com')`
   ile `signInWithCredential` kullanılır (veya `expo-auth-session` +
   Firebase custom token akışı — Expo kullanıyorsanız).
4. Giriş başarılı olduğunda Firebase otomatik olarak bir **ID token** üretir.
   Bu token her API isteğinde `Authorization: Bearer <token>` header'ı ile
   gönderilir (bkz. `api/client.ts`).
5. İlk API çağrısı her zaman `GET /auth/me` olmalıdır — backend bu noktada
   kullanıcıyı otomatik oluşturur/senkronlar ve rolünü döner.
6. `AuthContext`, dönen `roles` alanına göre `RootNavigator`'da hangi stack'in
   (`AdminStack` / `SellerStack` / `CustomerStack`) render edileceğine karar
   verir.

## Neden backend'de ayrı bir /register endpoint'i yok?

Firebase Authentication zaten kullanıcı oluşturma, şifre sıfırlama, email
doğrulama gibi tüm kimlik işlemlerini yönetiyor. Backend sadece token'ı
doğrulayıp kendi veritabanına (app_user/cust/role) senkronluyor. Bu, hem kod
tekrarını önler hem de Microsoft OIDC gibi ek sağlayıcıları tek noktadan
(Firebase Console) yönetmenizi sağlar.
