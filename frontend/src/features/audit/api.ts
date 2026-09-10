import { apiClient } from '@/api/client'
import type { AuditLog, AuditLogFilters, PaginatedResponse } from '@/api/types'

type AuditApiFilters = Omit<AuditLogFilters, 'occurredAfter' | 'occurredBefore'> & {
  startDate?: string
  endDate?: string
}

export function toAuditApiFilters(filters: AuditLogFilters): AuditApiFilters {
  const { occurredAfter, occurredBefore, ...rest } = filters
  return {
    ...rest,
    ...(occurredAfter ? { startDate: occurredAfter } : {}),
    ...(occurredBefore ? { endDate: occurredBefore } : {}),
  }
}

export const auditApi = {
  async list(filters: AuditLogFilters, signal?: AbortSignal): Promise<PaginatedResponse<AuditLog>> {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params: toAuditApiFilters(filters), signal })
    return response.data
  },
}
