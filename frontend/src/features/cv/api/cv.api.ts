import { apiClient } from '@/api/client';
import type { PaginatedResponse, SuccessResponse, Cv, SignedDownload, Operation } from '@/api/types';

export const cvApi = {
  /**
   * Candidate: Upload a new CV
   */
  uploadCv: async (file: File): Promise<SuccessResponse<{ cv: Cv; operation: Operation }>> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<SuccessResponse<{ cv: Cv; operation: Operation }>>('/cvs', formData, {
      headers: {
        // Axios/browser must generate the multipart boundary.
        'Content-Type': undefined,
      },
    });
    return response.data;
  },

  /**
   * Candidate: Get all CVs
   */
  getCvs: async (cursor?: string): Promise<PaginatedResponse<Cv>> => {
    const response = await apiClient.get<PaginatedResponse<Cv>>('/cvs', {
      params: { cursor },
    });
    return response.data;
  },

  /**
   * Candidate / Scoped Recruiter: Get CV by ID
   */
  getCv: async (cvId: string): Promise<SuccessResponse<Cv>> => {
    const response = await apiClient.get<SuccessResponse<Cv>>(`/cvs/${cvId}`);
    return response.data;
  },

  /**
   * Candidate: Set CV as default
   */
  setDefaultCv: async (cvId: string, expectedVersion: number): Promise<SuccessResponse<Cv>> => {
    const response = await apiClient.post<SuccessResponse<Cv>>(`/cvs/${cvId}/default`, {
      expectedVersion,
    });
    return response.data;
  },

  /**
   * Candidate / Scoped Recruiter: Get download URL
   */
  getDownloadUrl: async (cvId: string): Promise<SuccessResponse<SignedDownload>> => {
    const response = await apiClient.post<SuccessResponse<SignedDownload>>(`/cvs/${cvId}/download-url`);
    return response.data;
  },

  /**
   * Candidate: Delete a CV
   */
  deleteCv: async (cvId: string): Promise<void> => {
    await apiClient.delete(`/cvs/${cvId}`);
  },
};
