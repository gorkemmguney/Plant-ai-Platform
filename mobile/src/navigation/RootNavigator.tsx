import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AdminStack from './AdminStack';
import AuthStack from './AuthStack';
import CustomerStack from './CustomerStack';
import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import SellerStack from './SellerStack';

const stacksByRole = {
  admin: AdminStack,
  seller: SellerStack,
  customer: CustomerStack,
};

export default function RootNavigator() {
  const { firebaseUser, roles, activeRole, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!firebaseUser) {
    return (
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );
  }

  if (roles.length > 1 && (!activeRole || !roles.includes(activeRole))) {
    return (
      <NavigationContainer>
        <RoleSelectScreen />
      </NavigationContainer>
    );
  }

  const effectiveRole = activeRole && roles.includes(activeRole) ? activeRole : roles[0];
  const ActiveStack = effectiveRole ? stacksByRole[effectiveRole] : CustomerStack;

  return (
    <NavigationContainer>
      <ActiveStack />
    </NavigationContainer>
  );
}
