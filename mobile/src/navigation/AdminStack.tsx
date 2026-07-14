import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform } from 'react-native';
import SellerApprovalsScreen from '../screens/admin/SellerApprovalsScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import AIDiagnosisCenterScreen from '../screens/admin/AIDiagnosisCenterScreen';
import AIReportScreen from '../screens/admin/AIReportScreen';
import SettingsScreen from '../screens/customer/SettingsScreen';
import { colors, fonts } from '../theme/theme';

export type AdminTabParamList = {
  Users: undefined;
  Approvals: undefined;
  Diagnosis: undefined;
  Reports: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

const icons: Record<keyof AdminTabParamList, { active: any; inactive: any }> = {
  Users:     { active: 'people',          inactive: 'people-outline' },
  Approvals: { active: 'shield-checkmark', inactive: 'shield-checkmark-outline' },
  Diagnosis: { active: 'leaf',            inactive: 'leaf-outline' },
  Reports:   { active: 'document-text',   inactive: 'document-text-outline' },
  Settings:  { active: 'settings',        inactive: 'settings-outline' },
};

const labels: Record<keyof AdminTabParamList, string> = {
  Users:     'Kullanıcılar',
  Approvals: 'Onaylar',
  Diagnosis: 'AI Teşhis',
  Reports:   'AI Rapor',
  Settings:  'Ayarlar',
};

export default function AdminStack() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.buttonPrimary,
        tabBarInactiveTintColor: colors.muted2,
        tabBarLabelStyle: { fontFamily: fonts.sansSemi, fontSize: 10, marginBottom: Platform.OS === 'ios' ? 0 : 4 },
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
      <Tab.Screen name="Users"     component={UserManagementScreen}    options={{ title: labels.Users }} />
      <Tab.Screen name="Approvals" component={SellerApprovalsScreen}   options={{ title: labels.Approvals }} />
      <Tab.Screen name="Diagnosis" component={AIDiagnosisCenterScreen} options={{ title: labels.Diagnosis }} />
      <Tab.Screen name="Reports"   component={AIReportScreen}          options={{ title: labels.Reports }} />
      <Tab.Screen name="Settings"  component={SettingsScreen}          options={{ title: labels.Settings }} />
    </Tab.Navigator>
  );
}
