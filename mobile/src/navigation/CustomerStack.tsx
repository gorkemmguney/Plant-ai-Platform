import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { CartProvider } from '../context/CartContext';
import AIChatScreen from '../screens/customer/AIChatScreen';
import AIChatHistoryScreen from '../screens/customer/AIChatHistoryScreen';
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
import MyReviewsScreen from '../screens/customer/MyReviewsScreen';
import CampaignsScreen from '../screens/customer/CampaignsScreen';
import CommunityFeedScreen from '../screens/customer/CommunityFeedScreen';
import PostDetailScreen from '../screens/customer/PostDetailScreen';
import CreatePostScreen from '../screens/customer/CreatePostScreen';
import AddressScreen from '../screens/customer/AddressScreen';
import CheckoutScreen from '../screens/customer/CheckoutScreen';
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
  MyReviews: undefined;
  Campaigns: undefined;
  AddressScreen: undefined;
  Checkout: { couponId?: number | null; discount?: number } | undefined;
  ImageAnalysis: undefined;
  ChatScreen: { chatId?: number } | undefined;
  AIChatHistory: undefined;
  AnalysisResult: {
    analysisId: number;
    imageUrl: string;
    result: string; // JSON string
    confidence: number | null;
    createdAt: string;
    recommendedProducts?: any[];
  };
  CommunityFeed: undefined;
  PostDetail: { postId: number };
  CreatePost: undefined;
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
  Marketplace: 'Ürünler',
  Stores: 'Mağazalar',
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
        <Stack.Screen name="MyReviews" component={MyReviewsScreen} options={{ title: 'Değerlendirmelerim' }} />
        <Stack.Screen name="Campaigns" component={CampaignsScreen} options={{ title: 'Kampanyalar' }} />
        <Stack.Screen name="AddressScreen" component={AddressScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ImageAnalysis" component={ImageAnalysisScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ChatScreen" component={AIChatScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AIChatHistory" component={AIChatHistoryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CommunityFeed" component={CommunityFeedScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </CartProvider>
  );
}
