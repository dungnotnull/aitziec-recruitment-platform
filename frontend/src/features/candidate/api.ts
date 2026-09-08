import { apiClient } from '@/api/client';
import type { CandidateProfile, UpdateCandidateProfileInput, SuccessResponse } from '@/api/types';

export const getMyProfile = async (): Promise<CandidateProfile> => {
  const response = await apiClient.get<SuccessResponse<CandidateProfile>>('/candidates/me');
  return response.data.data;
};

export const updateMyProfile = async (data: UpdateCandidateProfileInput): Promise<CandidateProfile> => {
  const response = await apiClient.patch<SuccessResponse<CandidateProfile>>('/candidates/me', data);
  return response.data.data;
};
