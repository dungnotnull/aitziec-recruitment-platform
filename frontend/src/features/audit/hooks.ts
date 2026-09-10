import { useInfiniteQuery } from '@tanstack/react-query'
import type { AuditLogFilters } from '@/api/types'
import { auditApi } from './api'

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (filters: Omit<AuditLogFilters, 'cursor'>) => [...auditKeys.all, filters] as const,
}

export function useAuditLogs(filters: Omit<AuditLogFilters, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: auditKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => auditApi.list({ ...filters, cursor: pageParam }, signal),
    getNextPageParam: (lastPage) => lastPage.meta.page.hasNextPage
      ? lastPage.meta.page.nextCursor ?? undefined
      : undefined,
  })
}
