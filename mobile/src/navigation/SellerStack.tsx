import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import HomeScreen from '../screens/HomeScreen';

export type SellerStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<SellerStackParamList>();

export default function SellerStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Satıcı Paneli' }} />
    </Stack.Navigator>
  );
}
