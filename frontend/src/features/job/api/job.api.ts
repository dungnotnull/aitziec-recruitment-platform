import { apiClient } from '@/api/client';
import type {
  PaginatedResponse,
  SuccessResponse,
  Job,
  CreateJobRequest,
  UpdateJobRequest,
  JobSearchFilters,
} from '@/api/types';

export const jobApi = {
  /**
   * Public: Search and filter published jobs
   */
  getJobs: async (filters?: JobSearchFilters): Promise<PaginatedResponse<Job>> => {
    const response = await apiClient.get<PaginatedResponse<Job>>('/jobs', {
      params: filters,
    });
    return response.data;
  },

  /**
   * HR: Get all company jobs (including drafts)
   */
  getCompanyJobs: async (companyId: string, filters?: JobSearchFilters): Promise<PaginatedResponse<Job>> => {
    const response = await apiClient.get<PaginatedResponse<Job>>(`/companies/${companyId}/jobs`, {
      params: filters,
    });
    return response.data;
  },

  /**
   * Public or Scoped HR: Get job by ID or slug
   */
  getJob: async (jobIdOrSlug: string): Promise<SuccessResponse<Job>> => {
    const response = await apiClient.get<SuccessResponse<Job>>(`/jobs/${jobIdOrSlug}`);
    return response.data;
  },

  /**
   * HR: Create a draft job
   */
  createJob: async (
    companyId: string,
    data: CreateJobRequest,
    idempotencyKey?: string
  ): Promise<SuccessResponse<Job>> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const response = await apiClient.post<SuccessResponse<Job>>(
      `/companies/${companyId}/jobs`,
      data,
      { headers }
    );
    return response.data;
  },

  /**
   * HR: Update a job
   */
  updateJob: async (
    jobId: string,
    data: UpdateJobRequest
  ): Promise<SuccessResponse<Job>> => {
    const response = await apiClient.patch<SuccessResponse<Job>>(`/jobs/${jobId}`, data);
    return response.data;
  },

  /**
   * HR: Publish a draft job
   */
  publishJob: async (
    jobId: string,
    expectedVersion: number
  ): Promise<SuccessResponse<Job>> => {
    const response = await apiClient.post<SuccessResponse<Job>>(`/jobs/${jobId}/publish`, {
      expectedVersion,
    });
    return response.data;
  },

  /**
   * HR: Unpublish a job
   */
  unpublishJob: async (
    jobId: string,
    expectedVersion: number
  ): Promise<SuccessResponse<Job>> => {
    const response = await apiClient.post<SuccessResponse<Job>>(`/jobs/${jobId}/unpublish`, {
      expectedVersion,
    });
    return response.data;
  },

  /**
   * HR: Close a job
   */
  closeJob: async (
    jobId: string,
    expectedVersion: number,
    reason?: string
  ): Promise<SuccessResponse<Job>> => {
    const response = await apiClient.post<SuccessResponse<Job>>(`/jobs/${jobId}/close`, {
      expectedVersion,
      ...(reason ? { reason } : {}),
    });
    return response.data;
  },

  /**
   * Public: Parse natural language query to filters
   */
  parseSearchQuery: async (
    query: string
  ): Promise<SuccessResponse<JobSearchFilters>> => {
    const response = await apiClient.post<SuccessResponse<JobSearchFilters>>(
      '/jobs/search/parse',
      { query }
    );
    return response.data;
  },
};
