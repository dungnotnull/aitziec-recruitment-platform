import { apiClient } from '@/api/client';
import type { 
  HrInvitationItem, 
  HrProfile, 
  UpdateHrProfileInput, 
  PaginatedResponse, 
  SuccessResponse 
} from '@/api/types';

export const listMyHrInvitations = async (cursor?: string): Promise<PaginatedResponse<HrInvitationItem>> => {
  const params = cursor ? { cursor } : {};
  const response = await apiClient.get<PaginatedResponse<HrInvitationItem>>('/hr/invitations', { params });
  return response.data;
};

export const getMyHrProfile = async (): Promise<HrProfile> => {
  const response = await apiClient.get<SuccessResponse<HrProfile>>('/hr/me');
  return response.data.data;
};

export const updateMyHrProfile = async (data: UpdateHrProfileInput): Promise<HrProfile> => {
  const response = await apiClient.patch<SuccessResponse<HrProfile>>('/hr/me', data);
  return response.data.data;
};
