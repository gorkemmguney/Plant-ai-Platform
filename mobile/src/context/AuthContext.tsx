import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { firebaseAuth } from '../firebase/firebaseConfig';
import { apiClient } from '../services/apiClient';

type Role = 'admin' | 'seller' | 'customer';
export type SellerStatus = 'none' | 'pending' | 'verified' | 'rejected';

const ACTIVE_ROLE_KEY = 'plantai:activeRole';

interface AuthContextValue {
  firebaseUser: User | null;
  roles: Role[];
  activeRole: Role | null;
  sellerStatus: SellerStatus;
  firstName: string;
  lastName: string;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  /** Panel seçimini ayarlar. `null` verilirse seçim ekranına geri döner. */
  chooseRole: (role: Role | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  roles: [],
  activeRole: null,
  sellerStatus: 'none',
  firstName: '',
  lastName: '',
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
  const [loading, setLoading] = useState(true);

  const chooseRole = (role: Role | null) => {
    setActiveRole(role);
    if (role) {
      AsyncStorage.setItem(ACTIVE_ROLE_KEY, role).catch(() => {});
    } else {
      AsyncStorage.removeItem(ACTIVE_ROLE_KEY).catch(() => {});
    }
  };

  const refreshProfile = async () => {
    if (!firebaseAuth.currentUser) {
      setRoles([]);
      setSellerStatus('none');
      setFirstName('');
      setLastName('');
      return;
    }
    try {
      const { data } = await apiClient.get('/auth/me');
      const nextRoles: Role[] = data.roles ?? [];
      setRoles(nextRoles);
      setSellerStatus(data.seller_status ?? 'none');
      setFirstName(data.first_name ?? '');
      setLastName(data.last_name ?? '');

      // Kayıtlı panel seçimi hâlâ geçerli mi kontrol et; değilse temizle.
      setActiveRole((current) => (current && !nextRoles.includes(current) ? null : current));
      if (nextRoles.length === 1) {
        // Tek rolü olan kullanıcı için seçim ekranına hiç gerek yok.
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
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      // Her giriş/çıkışta, profil (roller) netleşene kadar tekrar "loading" durumuna geç.
      // Bu, giriş anında kısa süreliğine yanlış panelin (ör. Customer) görünüp
      // ardından doğru panele (ör. Admin/Seller) geçmesi sorununu önler.
      setLoading(true);
      setFirebaseUser(user);
      if (user) {
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
      setLoading(false);
    });
    return unsubscribe;
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
