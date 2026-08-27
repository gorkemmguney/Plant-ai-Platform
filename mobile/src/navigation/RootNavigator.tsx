import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
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

// plantai:// ile açılan linkler (şifre sıfırlama maili) buradan yakalanır.
const linking = {
  prefixes: ['plantai://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

const RecoveryStack = createNativeStackNavigator();

export default function RootNavigator() {
  const { firebaseUser, roles, activeRole, loading, passwordRecovery } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Supabase, sıfırlama linkine tıklandığında kullanıcıya geçici bir oturum açar
  // (PASSWORD_RECOVERY). Bu durumda normal login/panel akışını değil, doğrudan
  // yeni şifre ekranını göstermemiz gerekiyor — yoksa kullanıcı direkt ana
  // ekrana düşer ve şifresini hiç değiştiremez.
  if (passwordRecovery) {
    return (
      <NavigationContainer linking={linking}>
        <RecoveryStack.Navigator screenOptions={{ headerShown: false }}>
          <RecoveryStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </RecoveryStack.Navigator>
      </NavigationContainer>
    );
  }

  if (!firebaseUser) {
    return (
      <NavigationContainer linking={linking}>
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
