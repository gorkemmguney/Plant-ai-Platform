import axios from 'axios';
import { firebaseAuth } from '../firebase/firebaseConfig';

// Geliştirme sırasında gerçek makinenizin IP adresini kullanın (localhost telefonda çalışmaz).
// Terminalde `ipconfig getifaddr en0` (Mac) ile yerel IP'nizi öğrenebilirsiniz.

const BASE_URL = 'http://192.168.8.150:8000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Her istekte güncel Firebase ID token'ını otomatik ekler
apiClient.interceptors.request.use(async (config) => {
  const currentUser = firebaseAuth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 durumunda token'ı yenileyip tek seferlik retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && firebaseAuth.currentUser) {
      const freshToken = await firebaseAuth.currentUser?.getIdToken(true);
      if (freshToken && error.config) {
        error.config.headers.Authorization = `Bearer ${freshToken}`;
        return apiClient.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);
