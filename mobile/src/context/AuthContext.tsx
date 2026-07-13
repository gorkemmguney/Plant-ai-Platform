import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { firebaseAuth } from '../firebase/firebaseConfig';
import { apiClient } from '../services/apiClient';

type Role = 'admin' | 'seller' | 'customer';

interface AuthContextValue {
  firebaseUser: User | null;
  roles: Role[];
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  roles: [],
  loading: true,
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!firebaseAuth.currentUser) {
      setRoles([]);
      return;
    }
    try {
      const { data } = await apiClient.get('/auth/me');
      setRoles(data.roles ?? []);
    } catch (err: any) {
      console.log('[AuthContext] /auth/me başarısız:', err?.message ?? err);
      setRoles([]);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await refreshProfile();
      } else {
        setRoles([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, roles, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
