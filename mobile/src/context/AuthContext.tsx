import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

type Role = 'admin' | 'seller' | 'customer';

interface AuthContextValue {
  firebaseUser: FirebaseAuthTypes.User | null;
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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!auth().currentUser) {
      setRoles([]);
      return;
    }
    // Backend'de kullanıcıyı senkronlar ve rolünü döner
    const { data } = await apiClient.get('/auth/me');
    setRoles(data.roles ?? []);
  };

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
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
