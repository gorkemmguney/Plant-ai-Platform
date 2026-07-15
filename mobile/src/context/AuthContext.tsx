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
  firstName: string;
  lastName: string;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  roles: [],
  sellerStatus: 'none',
  firstName: '',
  lastName: '',
  loading: true,
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>('none');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);

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
      setRoles(data.roles ?? []);
      setSellerStatus(data.seller_status ?? 'none');
      setFirstName(data.first_name ?? '');
      setLastName(data.last_name ?? '');
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
      setFirebaseUser(user);
      if (user) {
        await refreshProfile();
      } else {
        setRoles([]);
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
      value={{ firebaseUser, roles, sellerStatus, firstName, lastName, loading, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
