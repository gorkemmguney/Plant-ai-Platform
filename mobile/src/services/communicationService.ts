import { apiClient } from './apiClient';

export interface CommAttachment {
  comm_attachment_id: number;
  attachment_type: string;
  url: string;
  mime_type?: string;
  file_name?: string;
  created_at: string;
}

export interface CommMessage {
  comm_message_id: number;
  comm_interaction_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  content: string;
  message_state: string;
  read_at?: string;
  created_at: string;
  attachments?: CommAttachment[];
}

export interface CommInteraction {
  comm_interaction_id: number;
  interaction_type: string;
  status: string;
  channel_type: string;
  subject?: string;
  customer_id: number;
  seller_id: number;
  partner_name: string;
  partner_avatar?: string;
  related_prod_id?: number;
  related_prod_name?: string;
  related_prod_image?: string;
  related_ord_id?: number;
  last_message_text?: string;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export const startCommunication = async (payload: {
  seller_id: number;
  related_prod_id?: number;
  related_ord_id?: number;
  subject?: string;
  initial_message?: string;
}): Promise<CommInteraction> => {
  const { data } = await apiClient.post<CommInteraction>('/communication/start', payload);
  return data;
};

export const fetchInteractions = async (): Promise<CommInteraction[]> => {
  const { data } = await apiClient.get<CommInteraction[]>('/communication/interactions');
  return data;
};

export const fetchMessages = async (interactionId: number): Promise<CommMessage[]> => {
  const { data } = await apiClient.get<CommMessage[]>(`/communication/interactions/${interactionId}/messages`);
  return data;
};

export const sendCommunicationMessage = async (
  interactionId: number,
  payload: { content: string; attachment_url?: string }
): Promise<CommMessage> => {
  const { data } = await apiClient.post<CommMessage>(`/communication/interactions/${interactionId}/messages`, payload);
  return data;
};
