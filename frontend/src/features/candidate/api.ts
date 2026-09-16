import { apiClient } from '@/api/client';
import type {
  CandidateProfile,
  UpdateCandidateProfileInput,
  SuccessResponse,
  SkillCatalogItem,
  PaginatedResponse,
} from '@/api/types';

export const getMyProfile = async (): Promise<CandidateProfile> => {
  const response = await apiClient.get<SuccessResponse<CandidateProfile>>('/candidates/me');
  return response.data.data;
};

export const updateMyProfile = async (data: UpdateCandidateProfileInput): Promise<CandidateProfile> => {
  const response = await apiClient.patch<SuccessResponse<CandidateProfile>>('/candidates/me', data);
  return response.data.data;
};

export const getSkillCatalog = async (search?: string, limit = 50): Promise<SkillCatalogItem[]> => {
  const response = await apiClient.get<PaginatedResponse<SkillCatalogItem>>('/skills', {
    params: {
      search: search?.trim() || undefined,
      limit,
      active: true,
    },
  });
  return response.data.data;
};
