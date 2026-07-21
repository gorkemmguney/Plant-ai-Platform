import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { PENDING_ROLE_PREFIX } from '../constants/auth';
import { supabase } from '../lib/supabaseClient';
import { apiClient } from '../services/apiClient';

type Role = 'admin' | 'seller' | 'customer';
export type SellerStatus = 'none' | 'pending' | 'verified' | 'rejected';

const ACTIVE_ROLE_KEY = 'plantai:activeRole';

interface AuthContextValue {
  // NOT: alan adı tarihsel nedenlerle "firebaseUser" kaldı (Firebase -> Supabase
  // geçişinde diğer ekranları değiştirmemek için) — artık Supabase User taşıyor.
  firebaseUser: User | null;
  roles: Role[];
  activeRole: Role | null;
  sellerStatus: SellerStatus;
  firstName: string;
  lastName: string;
  points: number;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  chooseRole: (role: Role | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  roles: [],
  activeRole: null,
  sellerStatus: 'none',
  firstName: '',
  lastName: '',
  points: 0,
  loading: true,
  refreshProfile: async () => {},
  chooseRole: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>('none');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

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
      return true;
    } catch (err: any) {
      console.log('[AuthContext] bekleyen rol uygulanamadı:', err?.message ?? err);
      return false;
    }
  };

  const refreshProfile = async () => {
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
      setRoles(nextRoles);
      setSellerStatus(data.seller_status ?? 'none');
      setFirstName(data.first_name ?? '');
      setLastName(data.last_name ?? '');
      setPoints(data.points ?? 0);

      setActiveRole((current) => (current && !nextRoles.includes(current) ? null : current));
      if (nextRoles.length === 1) {
        chooseRole(nextRoles[0]);
      }
    } catch (err: any) {
      console.log('[AuthContext] /auth/me başarısız:', err?.message ?? err);
      setRoles([]);
      setSellerStatus('none');
      setFirstName('');
      setLastName('');
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
        setRoles([]);
        setActiveRole(null);
        setSellerStatus('none');
        setFirstName('');
        setLastName('');
      }
      if (mounted) setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        roles,
        activeRole,
        sellerStatus,
        firstName,
        lastName,
        points,
        loading,
        refreshProfile,
        chooseRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
