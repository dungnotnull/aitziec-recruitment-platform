import { apiClient } from '@/api/client';
import type {
  PaginatedResponse,
  SuccessResponse,
  Application,
  ApplicationDetail,
  SubmitApplicationRequest,
  TransitionApplicationRequest,
} from '@/api/types';

export const applicationApi = {
  /**
   * Candidate: Apply for a job
   */
  submitApplication: async (
    jobId: string,
    data: SubmitApplicationRequest,
    idempotencyKey?: string
  ): Promise<SuccessResponse<Application>> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const response = await apiClient.post<SuccessResponse<Application>>(
      `/jobs/${jobId}/applications`,
      data,
      { headers }
    );
    return response.data;
  },

  /**
   * Candidate: Get own applications
   */
  getCandidateApplications: async (
    status?: string,
    cursor?: string
  ): Promise<PaginatedResponse<ApplicationDetail>> => {
    const response = await apiClient.get<PaginatedResponse<ApplicationDetail>>('/applications', {
      params: { status, cursor },
    });
    return response.data;
  },

  /**
   * HR: Get applications for a job
   */
  getJobApplications: async (
    jobId: string,
    status?: string,
    cursor?: string,
    sort?: string
  ): Promise<PaginatedResponse<ApplicationDetail>> => {
    const response = await apiClient.get<PaginatedResponse<ApplicationDetail>>(
      `/jobs/${jobId}/applications`,
      { params: { status, cursor, sort } }
    );
    return response.data;
  },

  /**
   * Owner/HR: Get application detail
   */
  getApplicationDetail: async (applicationId: string): Promise<SuccessResponse<ApplicationDetail>> => {
    const response = await apiClient.get<SuccessResponse<ApplicationDetail>>(`/applications/${applicationId}`);
    return response.data;
  },

  /**
   * HR: Transition application status
   */
  transitionApplication: async (
    applicationId: string,
    data: TransitionApplicationRequest,
    idempotencyKey?: string
  ): Promise<SuccessResponse<ApplicationDetail>> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const response = await apiClient.post<SuccessResponse<ApplicationDetail>>(
      `/applications/${applicationId}/transitions`,
      data,
      { headers }
    );
    return response.data;
  },
};
