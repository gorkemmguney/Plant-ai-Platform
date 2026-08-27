import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { CartProvider } from '../context/CartContext';
import { useI18n } from '../i18n';
import AIChatScreen from '../screens/customer/AIChatScreen';
import AIChatHistoryScreen from '../screens/customer/AIChatHistoryScreen';
import CartScreen from '../screens/customer/CartScreen';
import HomeScreen from '../screens/customer/HomeScreen';
import MarketplaceScreen from '../screens/customer/MarketplaceScreen';
import NotificationsScreen from '../screens/customer/NotificationsScreen';
import OrdersScreen from '../screens/customer/OrdersScreen';
import SettingsScreen from '../screens/customer/SettingsScreen';
import AppSettingsScreen from '../screens/shared/AppSettingsScreen';
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
import MyGardenScreen from '../screens/customer/MyGardenScreen';
import AddPlantScreen from '../screens/customer/AddPlantScreen';
import PlantDetailScreen from '../screens/customer/PlantDetailScreen';
import SupportScreen from '../screens/shared/SupportScreen';
import SellerChatListScreen from '../screens/customer/SellerChatListScreen';
import SellerChatDetailScreen from '../screens/customer/SellerChatDetailScreen';
import UserProfileScreen from '../screens/shared/UserProfileScreen';
import PublicProfileScreen from '../screens/shared/PublicProfileScreen';
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
  Support: { sourcePanel?: 'customer' | 'seller' } | undefined;
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
  MyGarden: undefined;
  AddPlant: { prefilledData?: { prodSpecId: number; species: string; healthStatus: string; imageUrl?: string } };
  PlantDetail: { custProdId: number };
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

const Tab = createBottomTabNavigator<CustomerTabParamList>();
const Stack = createNativeStackNavigator<CustomerStackParamList>();

const icons: Record<keyof CustomerTabParamList, { active: any; inactive: any }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Marketplace: { active: 'leaf', inactive: 'leaf-outline' },
  Stores: { active: 'storefront', inactive: 'storefront-outline' },
  AIChat: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

const labelKeys: Record<keyof CustomerTabParamList, string> = {
  Home: 'tab.home',
  Marketplace: 'tab.marketplace',
  Stores: 'tab.stores',
  AIChat: 'tab.aichat',
  Settings: 'tab.settings',
};

function CustomerTabNavigator() {
  const { t } = useI18n();
  const labels: Record<keyof CustomerTabParamList, string> = {
    Home: t(labelKeys.Home),
    Marketplace: t(labelKeys.Marketplace),
    Stores: t(labelKeys.Stores),
    AIChat: t(labelKeys.AIChat),
    Settings: t(labelKeys.Settings),
  };
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
  const { t } = useI18n();
  return (
    <CartProvider>
      <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="Tabs" component={CustomerTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ title: t('nav.cart') }} />
        <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: t('nav.orders') }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('nav.notifications') }} />
        <Stack.Screen name="StoreProducts" component={StoreProductsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MyReviews" component={MyReviewsScreen} options={{ title: t('nav.myReviews') }} />
        <Stack.Screen name="Campaigns" component={CampaignsScreen} options={{ title: t('nav.campaigns') }} />
        <Stack.Screen name="AddressScreen" component={AddressScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Support" component={SupportScreen} options={{ headerShown: false }} initialParams={{ sourcePanel: 'customer' }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ImageAnalysis" component={ImageAnalysisScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ChatScreen" component={AIChatScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AIChatHistory" component={AIChatHistoryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CommunityFeed" component={CommunityFeedScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MyGarden" component={MyGardenScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AddPlant" component={AddPlantScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PlantDetail" component={PlantDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AppSettings" component={AppSettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SellerChatList" component={SellerChatListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SellerChatDetail" component={SellerChatDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </CartProvider>
  );
}
