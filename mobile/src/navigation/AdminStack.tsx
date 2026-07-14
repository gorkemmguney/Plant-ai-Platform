import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform } from 'react-native';
import SellerApprovalsScreen from '../screens/admin/SellerApprovalsScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import SettingsScreen from '../screens/customer/SettingsScreen';
import { colors, fonts } from '../theme/theme';

export type AdminTabParamList = {
  Users: undefined;
  Approvals: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

const icons: Record<keyof AdminTabParamList, { active: any; inactive: any }> = {
  Users: { active: 'people', inactive: 'people-outline' },
  Approvals: { active: 'shield-checkmark', inactive: 'shield-checkmark-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

const labels: Record<keyof AdminTabParamList, string> = {
  Users: 'Kullanıcılar',
  Approvals: 'Onaylar',
  Settings: 'Ayarlar',
};

export default function AdminStack() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.buttonPrimary,
        tabBarInactiveTintColor: colors.muted2,
        tabBarLabelStyle: { fontFamily: fonts.sansSemi, fontSize: 10.5, marginBottom: Platform.OS === 'ios' ? 0 : 4 },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const name = route.name as keyof AdminTabParamList;
          const iconName = focused ? icons[name].active : icons[name].inactive;
          return <Ionicons name={iconName} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Users" component={UserManagementScreen} options={{ title: labels.Users }} />
      <Tab.Screen name="Approvals" component={SellerApprovalsScreen} options={{ title: labels.Approvals }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: labels.Settings }} />
    </Tab.Navigator>
  );
}
