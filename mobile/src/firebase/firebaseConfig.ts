import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAlVcSvhFXZ_8vIVSkutUeueQ1sjAALkHo',
  authDomain: 'plant-ai-platform.firebaseapp.com',
  projectId: 'plant-ai-platform',
  storageBucket: 'plant-ai-platform.firebasestorage.app',
};

export const firebaseApp = initializeApp(firebaseConfig);

export const firebaseAuth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(AsyncStorage),
});
