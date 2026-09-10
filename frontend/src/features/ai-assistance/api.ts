import { apiClient } from '@/api/client'
import type {
  AiAnalysis,
  CreateCvJobAnalysisRequest,
  Job,
  Operation,
  PaginatedResponse,
  SuccessResponse,
} from '@/api/types'

export const aiApi = {
  async createCvJobAnalysis(
    input: CreateCvJobAnalysisRequest,
    idempotencyKey: string,
  ): Promise<SuccessResponse<Operation>> {
    const response = await apiClient.post<SuccessResponse<Operation>>('/ai/cv-job-analyses', input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    return response.data
  },

  async getAnalysis(analysisId: string, signal?: AbortSignal): Promise<SuccessResponse<AiAnalysis>> {
    const response = await apiClient.get<SuccessResponse<AiAnalysis>>(
      `/ai/analyses/${encodeURIComponent(analysisId)}`,
      { signal },
    )
    return response.data
  },

  async getRecommendations(cursor?: string, limit = 20, signal?: AbortSignal): Promise<PaginatedResponse<Job>> {
    const response = await apiClient.get<PaginatedResponse<Job>>('/recommendations/jobs', {
      params: { cursor, limit },
      signal,
    })
    return response.data
  },
}
