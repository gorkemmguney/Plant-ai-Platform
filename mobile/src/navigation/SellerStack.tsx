import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';
import OrdersScreen from '../screens/seller/OrdersScreen';
import ProductsScreen from '../screens/seller/ProductsScreen';
import SellerAIReportScreen from '../screens/seller/SellerAIReportScreen';
import SellerReviewsScreen from '../screens/seller/SellerReviewsScreen';
import SettingsScreen from '../screens/seller/SettingsScreen';
import SupportScreen from '../screens/shared/SupportScreen';
import AppSettingsScreen from '../screens/shared/AppSettingsScreen';
import SellerChatListScreen from '../screens/customer/SellerChatListScreen';
import SellerChatDetailScreen from '../screens/customer/SellerChatDetailScreen';
import UserProfileScreen from '../screens/shared/UserProfileScreen';
import PublicProfileScreen from '../screens/shared/PublicProfileScreen';
import { useI18n } from '../i18n';
import { colors, fonts } from '../theme/theme';

export type SellerTabParamList = {
  Products: undefined;
  Orders: undefined;
  Reviews: undefined;
  AIReport: undefined;
  Settings: undefined;
};

export type SellerStackParamList = {
  Tabs: undefined;
  Support: { sourcePanel?: 'customer' | 'seller' } | undefined;
  AppSettings: undefined;
  SellerChatList: undefined;
  SellerChatDetail: {
    interactionId: number;
    partnerName: string;
    prodName?: string;
    prodImage?: string;
  };
  UserProfile: undefined;
  PublicProfile: { userId: number };
};

const Tab = createBottomTabNavigator<SellerTabParamList>();
const Stack = createNativeStackNavigator<SellerStackParamList>();

const icons: Record<keyof SellerTabParamList, { active: any; inactive: any }> = {
  Products: { active: 'pricetags', inactive: 'pricetags-outline' },
  Orders: { active: 'receipt', inactive: 'receipt-outline' },
  Reviews: { active: 'star', inactive: 'star-outline' },
  AIReport: { active: 'sparkles', inactive: 'sparkles-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

const labelKeys: Record<keyof SellerTabParamList, string> = {
  Products: 'sellerTab.products',
  Orders: 'sellerTab.orders',
  Reviews: 'sellerTab.reviews',
  AIReport: 'sellerTab.aiReport',
  Settings: 'sellerTab.settings',
};

function SellerTabNavigator() {
  const { t } = useI18n();
  const labels: Record<keyof SellerTabParamList, string> = {
    Products: t(labelKeys.Products),
    Orders: t(labelKeys.Orders),
    Reviews: t(labelKeys.Reviews),
    AIReport: t(labelKeys.AIReport),
    Settings: t(labelKeys.Settings),
  };
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
      <Tab.Screen name="Reviews" component={SellerReviewsScreen} options={{ title: labels.Reviews }} />
      <Tab.Screen name="AIReport" component={SellerAIReportScreen} options={{ title: labels.AIReport }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: labels.Settings }} />
    </Tab.Navigator>
  );
}

export default function SellerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="Tabs" component={SellerTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Support" component={SupportScreen} options={{ headerShown: false }} initialParams={{ sourcePanel: 'seller' }} />
      <Stack.Screen name="AppSettings" component={AppSettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SellerChatList" component={SellerChatListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SellerChatDetail" component={SellerChatDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
