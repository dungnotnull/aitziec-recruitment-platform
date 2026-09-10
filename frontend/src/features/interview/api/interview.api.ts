import { apiClient } from '@/api/client';
import type {
  PaginatedResponse,
  SuccessResponse,
  Interview,
  CreateInterviewRequest,
  UpdateInterviewRequest,
} from '@/api/types';

export const interviewApi = {
  /**
   * HR: Schedule an interview for an application
   */
  createInterview: async (
    applicationId: string,
    data: CreateInterviewRequest,
    idempotencyKey?: string
  ): Promise<SuccessResponse<Interview>> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    const response = await apiClient.post<SuccessResponse<Interview>>(
      `/applications/${applicationId}/interviews`,
      data,
      { headers }
    );
    return response.data;
  },

  /**
   * Candidate or HR: Get interviews for an application
   */
  getInterviews: async (
    applicationId: string,
    cursor?: string
  ): Promise<PaginatedResponse<Interview>> => {
    const response = await apiClient.get<{
      data: Interview[]
      meta: { hasMore: boolean; nextCursor: string | null; total: number; requestId?: string }
    }>(
      `/applications/${applicationId}/interviews`,
      { params: { cursor } }
    );
    return {
      data: response.data.data,
      meta: {
        ...(response.data.meta.requestId ? { requestId: response.data.meta.requestId } : {}),
        page: {
          hasNextPage: response.data.meta.hasMore,
          nextCursor: response.data.meta.nextCursor,
          limit: 20,
        },
      },
    };
  },

  /** Candidate or scoped HR: Get a single authorized interview. */
  getInterview: async (interviewId: string): Promise<SuccessResponse<Interview>> => {
    const response = await apiClient.get<SuccessResponse<Interview>>(
      `/interviews/${encodeURIComponent(interviewId)}`
    );
    return response.data;
  },

  /**
   * HR: Update/reschedule an interview
   */
  updateInterview: async (
    interviewId: string,
    data: UpdateInterviewRequest
  ): Promise<SuccessResponse<Interview>> => {
    const response = await apiClient.patch<SuccessResponse<Interview>>(
      `/interviews/${interviewId}`,
      data
    );
    return response.data;
  },

  /**
   * HR: Complete an interview
   */
  completeInterview: async (
    interviewId: string,
    expectedVersion: number,
    recruiterFeedback?: string
  ): Promise<SuccessResponse<Interview>> => {
    const response = await apiClient.post<SuccessResponse<Interview>>(
      `/interviews/${interviewId}/complete`,
      { expectedVersion, recruiterFeedback }
    );
    return response.data;
  },

  /**
   * HR: Cancel an interview
   */
  cancelInterview: async (
    interviewId: string,
    expectedVersion: number,
    reason: string
  ): Promise<SuccessResponse<Interview>> => {
    const response = await apiClient.post<SuccessResponse<Interview>>(
      `/interviews/${interviewId}/cancel`,
      { expectedVersion, reason }
    );
    return response.data;
  },
};
