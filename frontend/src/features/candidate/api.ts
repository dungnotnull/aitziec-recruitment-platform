import { apiClient } from '@/api/client';
import type { CandidateProfile, UpdateCandidateProfileInput } from '@/api/types';

export const getMyProfile = async (): Promise<CandidateProfile> => {
  const response = await apiClient.get<CandidateProfile>('/candidates/me');
  return response.data;
};

export const updateMyProfile = async (data: UpdateCandidateProfileInput): Promise<CandidateProfile> => {
  const response = await apiClient.patch<CandidateProfile>('/candidates/me', data);
  return response.data;
};
