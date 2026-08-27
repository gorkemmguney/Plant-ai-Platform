import { apiClient } from './apiClient';

export interface TMFPartyCharacteristic {
  name: string;
  value?: string;
  value_type: string;
}

export interface CustomerPartyProfile {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  city?: string;
  bio?: string;
  avatar_url?: string;
  cover_image_url?: string;
  points: number;
  followers_count: number;
  following_count: number;
  is_followed_by_me: boolean;
  badges: string[];
  plant_count: number;
  post_count: number;
  order_count: number;
  created_at: string;
  party_characteristics: TMFPartyCharacteristic[];
}

export interface SellerPartyProfile {
  user_id: number;
  store_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  seller_status: string;
  city?: string;
  bio?: string;
  avatar_url?: string;
  cover_image_url?: string;
  followers_count: number;
  following_count: number;
  is_followed_by_me: boolean;
  rating_score: number;
  review_count: number;
  product_count: number;
  badges: string[];
  created_at: string;
  party_characteristics: TMFPartyCharacteristic[];
}

export interface GenericPartyProfile {
  user_id: number;
  role: 'customer' | 'seller' | 'admin';
  customer_profile?: CustomerPartyProfile;
  seller_profile?: SellerPartyProfile;
}

export interface UserPostSummary {
  post_id: number;
  user_id: number;
  author_name: string;
  title: string;
  content: string;
  image_url?: string;
  tag: string;
  like_count: number;
  comment_count: number;
  is_liked_by_me: boolean;
  created_at: string;
}

export interface UserPlantSummary {
  cust_prod_id: number;
  nickname: string;
  species: string;
  health_status: string;
  image_url?: string;
  created_at: string;
}

export const fetchMyProfile = async (): Promise<GenericPartyProfile> => {
  const { data } = await apiClient.get<GenericPartyProfile>('/users/profile/me');
  return data;
};

export const fetchPublicProfile = async (userId: number): Promise<GenericPartyProfile> => {
  const { data } = await apiClient.get<GenericPartyProfile>(`/users/profile/${userId}`);
  return data;
};

export const updateMyProfile = async (payload: {
  first_name?: string;
  last_name?: string;
  store_name?: string;
  bio?: string;
  city?: string;
  avatar_url?: string;
  cover_image_url?: string;
}): Promise<GenericPartyProfile> => {
  const { data } = await apiClient.put<GenericPartyProfile>('/users/profile/me', payload);
  return data;
};

export const toggleFollowUser = async (userId: number): Promise<{ is_following: boolean; message: string }> => {
  const { data } = await apiClient.post<{ is_following: boolean; message: string }>(`/users/profile/${userId}/follow`);
  return data;
};

export const fetchUserPosts = async (userId: number): Promise<UserPostSummary[]> => {
  try {
    const { data } = await apiClient.get<UserPostSummary[]>(`/users/profile/${userId}/posts`);
    return data;
  } catch (err) {
    console.log('[profileService] fetchUserPosts fallback to /community/posts');
    try {
      const { data } = await apiClient.get<any[]>('/community/posts');
      return data
        .filter((p: any) => Number(p.user_id) === Number(userId))
        .map((p: any) => ({
          post_id: p.post_id,
          user_id: p.user_id,
          author_name: p.author_name,
          title: p.title,
          content: p.content,
          image_url: p.image_url,
          tag: p.tag,
          like_count: p.like_count || 0,
          comment_count: p.comment_count || 0,
          is_liked_by_me: p.is_liked_by_me || false,
          created_at: p.created_at,
        }));
    } catch {
      return [];
    }
  }
};

export const fetchUserPlants = async (userId: number): Promise<UserPlantSummary[]> => {
  try {
    const { data } = await apiClient.get<UserPlantSummary[]>(`/users/profile/${userId}/plants`);
    return data;
  } catch (err) {
    console.log('[profileService] fetchUserPlants fallback');
    try {
      const { data } = await apiClient.get<any[]>('/customer-products/my-plants');
      return data.map((p: any) => ({
        cust_prod_id: p.cust_prod_id,
        nickname: p.nickname || p.species || 'Bitkim',
        species: p.species || 'Bilinmeyen Tür',
        health_status: p.health_status || 'İyi',
        image_url: p.image_url,
        created_at: p.created_at || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }
};

export const fetchUserLikedPosts = async (userId: number): Promise<UserPostSummary[]> => {
  try {
    const { data } = await apiClient.get<UserPostSummary[]>(`/users/profile/${userId}/liked-posts`);
    return data;
  } catch (err) {
    console.log('[profileService] fetchUserLikedPosts fallback');
    try {
      const { data } = await apiClient.get<any[]>('/community/posts');
      return data
        .filter((p: any) => p.is_liked_by_me)
        .map((p: any) => ({
          post_id: p.post_id,
          user_id: p.user_id,
          author_name: p.author_name,
          title: p.title,
          content: p.content,
          image_url: p.image_url,
          tag: p.tag,
          like_count: p.like_count || 0,
          comment_count: p.comment_count || 0,
          is_liked_by_me: true,
          created_at: p.created_at,
        }));
    } catch {
      return [];
    }
  }
};
