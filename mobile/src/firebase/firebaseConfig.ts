import { initializeApp } from 'firebase/app';
// @ts-ignore: getReactNativePersistence çalışma zamanında mevcut, tip tanımlarında eksik
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAlVcSvhFXZ_8vIVSkutUeueQ1sjAALkHo',
  authDomain: 'plant-ai-platform.firebaseapp.com',
  projectId: 'plant-ai-platform',
  storageBucket: 'plant-ai-platform.firebasestorage.app',
  messagingSenderId: '917921949992',
  appId: '1:917921949992:web:0fe4068e74c40f2aba881d',
};

export const firebaseApp = initializeApp(firebaseConfig);

export const firebaseAuth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(AsyncStorage),
});
