import auth from '@react-native-firebase/auth';
import axios from 'axios';

// Geliştirme sırasında .env veya app.config.js üzerinden yönetin
const BASE_URL = 'https://YOUR_BACKEND_URL';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Her istekte güncel Firebase ID token'ını otomatik ekler
apiClient.interceptors.request.use(async (config) => {
  const currentUser = auth().currentUser;
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
    if (error.response?.status === 401 && auth().currentUser) {
      const freshToken = await auth().currentUser?.getIdToken(true);
      if (freshToken && error.config) {
        error.config.headers.Authorization = `Bearer ${freshToken}`;
        return apiClient.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);
