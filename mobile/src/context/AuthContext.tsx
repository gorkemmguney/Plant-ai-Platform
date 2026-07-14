import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { firebaseAuth } from '../firebase/firebaseConfig';
import { apiClient } from '../services/apiClient';

type Role = 'admin' | 'seller' | 'customer';
export type SellerStatus = 'none' | 'pending' | 'verified' | 'rejected';

interface AuthContextValue {
  firebaseUser: User | null;
  roles: Role[];
  sellerStatus: SellerStatus;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  roles: [],
  sellerStatus: 'none',
  loading: true,
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>('none');
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!firebaseAuth.currentUser) {
      setRoles([]);
      setSellerStatus('none');
      return;
    }
    try {
      const { data } = await apiClient.get('/auth/me');
      setRoles(data.roles ?? []);
      setSellerStatus(data.seller_status ?? 'none');
    } catch (err: any) {
      console.log('[AuthContext] /auth/me başarısız:', err?.message ?? err);
      setRoles([]);
      setSellerStatus('none');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await refreshProfile();
      } else {
        setRoles([]);
        setSellerStatus('none');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, roles, sellerStatus, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
