import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

const BASE_URL = 'https://plant-ai-backend-production-bcaf.up.railway.app';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

apiClient.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && data.session?.access_token && error.config) {
        error.config.headers.Authorization = `Bearer ${data.session.access_token}`;
        return apiClient.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);
