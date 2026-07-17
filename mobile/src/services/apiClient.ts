import axios from 'axios';
import { firebaseAuth } from '../firebase/firebaseConfig';


const BASE_URL = 'http://192.168.1.102:8000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});


apiClient.interceptors.request.use(async (config) => {
  const currentUser = firebaseAuth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
