import { apiClient } from '@/api/client'
import type { AuditLog, AuditLogFilters, PaginatedResponse } from '@/api/types'

export const auditApi = {
  async list(filters: AuditLogFilters, signal?: AbortSignal): Promise<PaginatedResponse<AuditLog>> {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params: filters, signal })
    return response.data
  },
}
