import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';
import { CartProvider } from '../context/CartContext';
import AIChatScreen from '../screens/customer/AIChatScreen';
import CartScreen from '../screens/customer/CartScreen';
import HomeScreen from '../screens/customer/HomeScreen';
import MarketplaceScreen from '../screens/customer/MarketplaceScreen';
import NotificationsScreen from '../screens/customer/NotificationsScreen';
import OrdersScreen from '../screens/customer/OrdersScreen';
import SettingsScreen from '../screens/customer/SettingsScreen';
import StoreProductsScreen from '../screens/customer/StoreProductsScreen';
import StoresScreen from '../screens/customer/StoresScreen';
import ImageAnalysisScreen from '../screens/customer/ImageAnalysisScreen';
import AnalysisResultScreen from '../screens/customer/AnalysisResultScreen';
import { colors, fonts } from '../theme/theme';

export type CustomerTabParamList = {
  Home: undefined;
  Marketplace: undefined;
  Stores: undefined;
  AIChat: undefined;
  Settings: undefined;
};

export type CustomerStackParamList = {
  Tabs: undefined;
  Cart: undefined;
  Orders: undefined;
  Notifications: undefined;
  StoreProducts: { sellerId: number; sellerName: string };
  MainTabs: undefined;
  ImageAnalysis: undefined;
  AnalysisResult: {
    analysisId: number;
    imageUrl: string;
    result: string; // JSON string
    confidence: number | null;
    createdAt: string;
    recommendedProducts?: any[];
  };
};

const Tab = createBottomTabNavigator<CustomerTabParamList>();
const Stack = createNativeStackNavigator<CustomerStackParamList>();

const icons: Record<keyof CustomerTabParamList, { active: any; inactive: any }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Marketplace: { active: 'storefront', inactive: 'storefront-outline' },
  Stores: { active: 'business', inactive: 'business-outline' },
  AIChat: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

const labels: Record<keyof CustomerTabParamList, string> = {
  Home: 'Ana Sayfa',
  Marketplace: 'Mağaza',
  Stores: 'Satıcılar',
  AIChat: 'AI Chat',
  Settings: 'Ayarlar',
};

function CustomerTabs() {
function CustomerTabNavigator() {
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
          const name = route.name as keyof CustomerTabParamList;
          const iconName = focused ? icons[name].active : icons[name].inactive;
          return <Ionicons name={iconName} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: labels.Home }} />
      <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: labels.Marketplace }} />
      <Tab.Screen name="Stores" component={StoresScreen} options={{ title: labels.Stores }} />
      <Tab.Screen name="AIChat" component={AIChatScreen} options={{ title: labels.AIChat }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: labels.Settings }} />
    </Tab.Navigator>
  );
}

export default function CustomerStack() {
  return (
    <CartProvider>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={CustomerTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Sepetim' }} />
        <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: 'Siparişlerim' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Bildirimler' }} />
        <Stack.Screen name="StoreProducts" component={StoreProductsScreen} options={{ title: 'Mağaza' }} />
      </Stack.Navigator>
    </CartProvider>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={CustomerTabNavigator} />
      <Stack.Screen name="ImageAnalysis" component={ImageAnalysisScreen} />
      <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} />
    </Stack.Navigator>
  );
}
