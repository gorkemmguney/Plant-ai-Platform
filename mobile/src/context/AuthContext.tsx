import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { PENDING_ROLE_PREFIX } from '../constants/auth';
import { supabase } from '../lib/supabaseClient';
import { apiClient } from '../services/apiClient';

type Role = 'admin' | 'seller' | 'customer';
export type SellerStatus = 'none' | 'pending' | 'verified' | 'rejected';

const ACTIVE_ROLE_KEY = 'plantai:activeRole';

interface AuthContextValue {
  firebaseUser: User | null;
  userId: number | null;
  roles: Role[];
  activeRole: Role | null;
  sellerStatus: SellerStatus;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  storeName: string;
  storeAddress: string;
  bankIban: string;
  points: number;
  loading: boolean;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>;
  chooseRole: (role: Role | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userId: null,
  roles: [],
  activeRole: null,
  sellerStatus: 'none',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  storeName: '',
  storeAddress: '',
  bankIban: '',
  points: 0,
  loading: true,
  passwordRecovery: false,
  clearPasswordRecovery: () => {},
  refreshProfile: async () => {},
  chooseRole: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>('none');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  // Supabase, şifre sıfırlama linkine tıklandığında kullanıcıyı geçici bir
  // "recovery" oturumuyla giriş yaptırır (PASSWORD_RECOVERY event). Bu true
  // olduğunda RootNavigator normal ekranlar yerine ResetPasswordScreen'i
  // gösterir — yoksa kullanıcı doğrudan ana ekrana düşer, şifresini hiç
  // değiştiremez.
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const clearPasswordRecovery = () => setPasswordRecovery(false);

  const chooseRole = (role: Role | null) => {
    setActiveRole(role);
    if (role) {
      AsyncStorage.setItem(ACTIVE_ROLE_KEY, role).catch(() => {});
    } else {
      AsyncStorage.removeItem(ACTIVE_ROLE_KEY).catch(() => {});
    }
  };

  const applyPendingRoleIfAny = async (email: string | undefined) => {
    if (!email) return false;
    const key = `${PENDING_ROLE_PREFIX}${email.toLowerCase()}`;
    const pendingRole = await AsyncStorage.getItem(key).catch(() => null);
    if (!pendingRole) return false;
    try {
      await apiClient.post('/auth/select-role', { role_name: pendingRole });
      await AsyncStorage.removeItem(key).catch(() => {});

      // Supabase oturumundaki user_metadata'yı (kayıt sırasında girilmiş bilgiler)
      // backend ind/org tablolarına aktar
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const meta = session?.user?.user_metadata ?? {};
        const userEmail = session?.user?.email ?? '';
        if (meta.first_name || meta.last_name || meta.phone_number || meta.store_name) {
          await apiClient.patch('/auth/me', {
            first_name: meta.first_name ?? '',
            last_name: meta.last_name ?? '',
            email: userEmail,
            phone_number: meta.phone_number ?? '',
            store_name: meta.store_name ?? '',
            store_address: meta.store_address ?? '',
            bank_iban: meta.bank_iban ?? '',
          });
        }

      } catch {
        // sessiz geç - metadata senkronizasyon hatası kritik değil
      }

      return true;
    } catch (err: any) {
      console.log('[AuthContext] bekleyen rol uygulanamadı:', err?.message ?? err);
      return false;
    }
  };


  // Backend'de "hesap" (app_user) ile "müşteri profili" (cust) ayrı şeyler —
  // cust, ayrı bir POST /customers/me çağrısıyla oluşuyor. Bunu ekran ekran
  // (checkout, adres ekleme...) tekrar tekrar kontrol etmek yerine, giriş/kayıt
  // sonrası burada TEK SEFER, kullanıcı 'customer' rolüne sahipse yapıyoruz.
  const ensureCustomerProfile = async () => {
    try {
      await apiClient.get('/customers/me');
    } catch (err: any) {
      if (err?.response?.status === 404) {
        try {
          await apiClient.post('/customers/me', { customer_type: 'IND', individual: {} });
        } catch (createErr: any) {
          console.log('[AuthContext] müşteri profili oluşturulamadı:', createErr?.message ?? createErr);
        }
      } else {
        console.log('[AuthContext] müşteri profili kontrol edilemedi:', err?.message ?? err);
      }
    }
  };

  // getSession() ve onAuthStateChange listener'ı mount anında neredeyse aynı
  // anda tetiklenebiliyor; ikisi de refreshProfile() çağırırsa (ör.
  // ensureCustomerProfile içindeki POST /customers/me) yarış durumu oluşur.
  // Aynı anda sadece TEK bir refreshProfile çalışmasını garanti ediyoruz.
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const refreshProfile = async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setRoles([]);
        setSellerStatus('none');
        setFirstName('');
        setLastName('');
        return;
      }

      try {
        let { data } = await apiClient.get('/auth/me');

        // Kayıt sırasında email onayı beklendiği için seçilen rol (özellikle 'seller'
        // başvurusu) backend'e bildirilememişse, kullanıcı ilk kez giriş yaptığında
        // burada tamamlanır. Backend zaten her kullanıcıya varsayılan 'customer'
        // rolünü otomatik atadığı için bu kontrolü rolün boş olmasına değil,
        // cihazda bekleyen bir seçim olup olmadığına dayandırıyoruz.
        const applied = await applyPendingRoleIfAny(session.user.email);
        if (applied) {
          ({ data } = await apiClient.get('/auth/me'));
        }

        const nextRoles: Role[] = data.roles ?? [];
        setUserId(data.user_id ?? null);
        setRoles(nextRoles);
        setSellerStatus(data.seller_status ?? 'none');
        setFirstName(data.first_name ?? '');
        setLastName(data.last_name ?? '');
        setPhoneNumber(data.phone_number ?? '');
        setStoreName(data.store_name ?? '');
        setStoreAddress(data.store_address ?? '');
        setBankIban(data.bank_iban ?? '');
        setPoints(data.points ?? 0);

        if (nextRoles.includes('customer')) {
          await ensureCustomerProfile();
        }

        setActiveRole((current) => (current && !nextRoles.includes(current) ? null : current));
        if (nextRoles.length === 1) {
          chooseRole(nextRoles[0]);
        }
      } catch (err: any) {
        console.log('[AuthContext] /auth/me başarısız:', err?.message ?? err);
        setUserId(null);
        setRoles([]);
        setSellerStatus('none');
        setFirstName('');
        setLastName('');
        setPhoneNumber('');
        setStoreName('');
        setStoreAddress('');
        setBankIban('');
      }

    };

    const promise = run();
    refreshInFlightRef.current = promise;
    try {
      await promise;
    } finally {
      refreshInFlightRef.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleSession = async (session: Session | null) => {
      if (!mounted) return;
      setLoading(true);
      setFirebaseUser(session?.user ?? null);
      if (session?.user) {
        const savedRole = (await AsyncStorage.getItem(ACTIVE_ROLE_KEY).catch(() => null)) as Role | null;
        if (savedRole) setActiveRole(savedRole);
        await refreshProfile();
      } else {
        setUserId(null);
        setRoles([]);
        setActiveRole(null);
        setSellerStatus('none');
        setFirstName('');
        setLastName('');
      }
      if (mounted) setLoading(false);
    };

    // supabaseClient.ts'te detectSessionInUrl:false — web'in aksine RN'de
    // gelen deep link URL'i Supabase kendiliğinden okumuyor. Şifre sıfırlama
    // linkiyle (plantai://reset-password?...) açıldığında token'ı burada elle
    // Supabase'e veriyoruz, yoksa PASSWORD_RECOVERY hiç tetiklenmez ve panel
    // hiç açılmaz.
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;
      try {
        if (url.includes('type=recovery') || url.includes('reset-password')) {
          setPasswordRecovery(true);
        }
        // PKCE akışı: ?code=... — Supabase yeni SDK'larda varsayılan bu.
        const codeMatch = url.match(/[?&]code=([^&]+)/);
        if (codeMatch) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) console.log('[AuthContext] exchangeCodeForSession hatası:', error.message);
          return;
        }
        // Eski (implicit) akış: #access_token=...&refresh_token=...
        const hash = url.includes('#') ? url.split('#')[1] : '';
        const params = new URLSearchParams(hash || url.split('?')[1] || '');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) console.log('[AuthContext] setSession hatası:', error.message);
        }
      } catch (err: any) {
        console.log('[AuthContext] deep link işlenemedi:', err?.message ?? err);
      }
    };

    // Uygulama kapalıyken linke tıklanmışsa (cold start)
    Linking.getInitialURL().then(handleDeepLink);
    // Uygulama açıkken linke tıklanmışsa (warm start)
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      handleSession(session);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userId,
        roles,
        activeRole,
        sellerStatus,
        firstName,
        lastName,
        phoneNumber,
        storeName,
        storeAddress,
        bankIban,
        points,
        loading,
        passwordRecovery,
        clearPasswordRecovery,
        refreshProfile,
        chooseRole,
      }}
    >

      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
