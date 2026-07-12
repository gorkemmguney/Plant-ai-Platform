import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AdminStack from './AdminStack';
import AuthStack from './AuthStack';
import CustomerStack from './CustomerStack';
import SellerStack from './SellerStack';

export default function RootNavigator() {
  const { firebaseUser, roles, loading } = useAuth();

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

  // Öncelik sırası: admin > seller > customer
  let ActiveStack = CustomerStack;
  if (roles.includes('admin')) {
    ActiveStack = AdminStack;
  } else if (roles.includes('seller')) {
    ActiveStack = SellerStack;
  }

  return (
    <NavigationContainer>
      <ActiveStack />
    </NavigationContainer>
  );
}
