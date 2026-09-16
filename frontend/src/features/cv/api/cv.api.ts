import { apiClient } from '@/api/client';
import type { PaginatedResponse, SuccessResponse, Cv, SignedDownload, Operation } from '@/api/types';
import { decodeFileName } from '@/shared/lib/file-name';

function normalizeCv(cv: Cv): Cv {
  if (!cv) return cv;
  return {
    ...cv,
    originalFileName: decodeFileName(cv.originalFileName),
  };
}

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
    const data = response.data;
    if (data?.data?.cv) {
      data.data.cv = normalizeCv(data.data.cv);
    }
    return data;
  },

  /**
   * Candidate: Get all CVs
   */
  getCvs: async (cursor?: string): Promise<PaginatedResponse<Cv>> => {
    const response = await apiClient.get<PaginatedResponse<Cv>>('/cvs', {
      params: { cursor },
    });
    const data = response.data;
    if (Array.isArray(data?.data)) {
      data.data = data.data.map(normalizeCv);
    }
    return data;
  },

  /**
   * Candidate / Scoped Recruiter: Get CV by ID
   */
  getCv: async (cvId: string): Promise<SuccessResponse<Cv>> => {
    const response = await apiClient.get<SuccessResponse<Cv>>(`/cvs/${cvId}`);
    const data = response.data;
    if (data?.data) {
      data.data = normalizeCv(data.data);
    }
    return data;
  },

  /**
   * Candidate: Set CV as default
   */
  setDefaultCv: async (cvId: string, expectedVersion: number): Promise<SuccessResponse<Cv>> => {
    const response = await apiClient.post<SuccessResponse<Cv>>(`/cvs/${cvId}/default`, {
      expectedVersion,
    });
    const data = response.data;
    if (data?.data) {
      data.data = normalizeCv(data.data);
    }
    return data;
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
