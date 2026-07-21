import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
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
import CustomTabBar from './CustomTabBar';

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
  ImageAnalysis: undefined;
  ChatScreen: undefined;
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
  Marketplace: { active: 'leaf', inactive: 'leaf-outline' },
  Stores: { active: 'storefront', inactive: 'storefront-outline' },
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

function CustomerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} icons={icons} labels={labels} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: labels.Home }} />
      <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: labels.Marketplace }} />
      <Tab.Screen name="Stores" component={StoresScreen} options={{ title: labels.Stores }} />
      <Tab.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{ title: labels.AIChat }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // AI sekmesi bir "tab içeriği" olarak açılmaz — dış Stack'teki
            // ChatScreen'i tam ekran açar (alt bar kaybolur), geri dönünce
            // hangi sekmedeysek oraya (alt bar tekrar görünür şekilde) döner.
            e.preventDefault();
            navigation.getParent()?.navigate('ChatScreen');
          },
        })}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: labels.Settings }} />
    </Tab.Navigator>
  );
}

export default function CustomerStack() {
  return (
    <CartProvider>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={CustomerTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Sepetim' }} />
        <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: 'Siparişlerim' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Bildirimler' }} />
        <Stack.Screen name="StoreProducts" component={StoreProductsScreen} options={{ title: 'Mağaza' }} />
        <Stack.Screen name="ImageAnalysis" component={ImageAnalysisScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ChatScreen" component={AIChatScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </CartProvider>
  );
}
