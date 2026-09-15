import { apiClient } from '@/api/client';
import type { PaginatedResponse, Job, SavedJobCheck, SuccessResponse } from '@/api/types';

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

  /**
   * Candidate: Check if a job is saved
   */
  checkSaved: async (jobId: string): Promise<SavedJobCheck> => {
    const response = await apiClient.get<SuccessResponse<SavedJobCheck>>(`/saved-jobs/${jobId}/check`);
    return response.data.data;
  },
};

