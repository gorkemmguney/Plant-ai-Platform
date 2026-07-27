import { apiClient } from './apiClient';

export type InteractionCode =
  | 'PROD_VIEW'
  | 'ADD_CART'
  | 'PURCHASE'
  | 'FAVORITE_ADD'
  | 'FAVORITE_REMOVE'
  | 'REVIEW_SUBMIT'
  | 'SUPPORT_TICKET'
  | 'AI_ANALYSIS'
  | 'STORE_VISIT'
  | 'COUPON_USE';

const SALE_CHANNEL_ID = 1;


export function trackInteraction(srtCode: InteractionCode) {
  apiClient
    .post('/interactions', { srt_code: srtCode, sale_cnl_id: SALE_CHANNEL_ID })
    .catch((err: any) => {
      console.log('[interactionService] izlenemedi:', srtCode, err?.message ?? err);
    });
}
