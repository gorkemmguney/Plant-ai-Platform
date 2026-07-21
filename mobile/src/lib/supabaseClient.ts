import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Bu "publishable key" bir gizli anahtar DEĞİLDİR — Firebase'deki apiKey gibi,
// istemci tarafında bulunması güvenlidir. Gerçek yetkilendirme Supabase'in
// Row Level Security + backend'deki JWT doğrulaması ile sağlanır.
const SUPABASE_URL = 'https://pbxlbqjbmdnxbrhvscev.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rGKK5sn8zPcoHHRPLmhG3A_tOPwWzVo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
