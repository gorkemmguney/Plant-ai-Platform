import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform } from 'react-native';
import OrdersScreen from '../screens/seller/OrdersScreen';
import ProductsScreen from '../screens/seller/ProductsScreen';
import SettingsScreen from '../screens/seller/SettingsScreen';
import { colors, fonts } from '../theme/theme';

export type SellerTabParamList = {
  Products: undefined;
  Orders: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<SellerTabParamList>();

const icons: Record<keyof SellerTabParamList, { active: any; inactive: any }> = {
  Products: { active: 'pricetags', inactive: 'pricetags-outline' },
  Orders: { active: 'receipt', inactive: 'receipt-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

const labels: Record<keyof SellerTabParamList, string> = {
  Products: 'Ürünler',
  Orders: 'Siparişler',
  Settings: 'Ayarlar',
};

export default function SellerStack() {
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
          const name = route.name as keyof SellerTabParamList;
          const iconName = focused ? icons[name].active : icons[name].inactive;
          return <Ionicons name={iconName} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Products" component={ProductsScreen} options={{ title: labels.Products }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: labels.Orders }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: labels.Settings }} />
    </Tab.Navigator>
  );
}
