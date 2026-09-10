import { apiClient } from '@/api/client'
import type {
  AdminUserFilters,
  Company,
  Job,
  ModerateJobRequest,
  PaginatedResponse,
  SuccessResponse,
  UpdateCompanyStatusRequest,
  UpdateUserStatusRequest,
  UserSummary,
} from '@/api/types'

export const adminApi = {
  async listUsers(filters: AdminUserFilters, signal?: AbortSignal): Promise<PaginatedResponse<UserSummary>> {
    const response = await apiClient.get<PaginatedResponse<UserSummary>>('/admin/users', { params: filters, signal })
    return response.data
  },
  async updateUserStatus(userId: string, input: UpdateUserStatusRequest): Promise<SuccessResponse<UserSummary>> {
    const response = await apiClient.patch<SuccessResponse<UserSummary>>(`/admin/users/${encodeURIComponent(userId)}/status`, input)
    return response.data
  },
  async updateCompanyStatus(companyId: string, input: UpdateCompanyStatusRequest): Promise<SuccessResponse<Company>> {
    const response = await apiClient.patch<SuccessResponse<Company>>(`/admin/companies/${encodeURIComponent(companyId)}/status`, input)
    return response.data
  },
  async moderateJob(jobId: string, input: ModerateJobRequest): Promise<SuccessResponse<Job>> {
    const response = await apiClient.post<SuccessResponse<Job>>(`/admin/jobs/${encodeURIComponent(jobId)}/moderate`, input)
    return response.data
  },
}
