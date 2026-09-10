import { apiClient } from '@/api/client';
import type { PaginatedResponse, Job } from '@/api/types';

export const savedJobsApi = {
  /**
   * Candidate: Get saved jobs
   */
  getSavedJobs: async (cursor?: string): Promise<PaginatedResponse<Job>> => {
    const response = await apiClient.get<PaginatedResponse<Job>>('/saved-jobs', {
      params: { cursor },
    });
    return response.data;
  },

  /**
   * Candidate: Save a job
   */
  saveJob: async (jobId: string): Promise<void> => {
    await apiClient.put(`/saved-jobs/${jobId}`);
  },

  /**
   * Candidate: Unsave a job
   */
  unsaveJob: async (jobId: string): Promise<void> => {
    await apiClient.delete(`/saved-jobs/${jobId}`);
  },
};
