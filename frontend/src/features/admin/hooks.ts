import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AdminUserFilters, UpdateUserStatusRequest } from '@/api/types'
import { adminApi } from './api'

export const adminKeys = {
  all: ['admin'] as const,
  users: (filters: Omit<AdminUserFilters, 'cursor'>) => [...adminKeys.all, 'users', filters] as const,
}

export function useAdminUsers(filters: Omit<AdminUserFilters, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: adminKeys.users(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => adminApi.listUsers({ ...filters, cursor: pageParam }, signal),
    getNextPageParam: (lastPage) => lastPage.meta.page.hasNextPage
      ? lastPage.meta.page.nextCursor ?? undefined
      : undefined,
  })
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateUserStatusRequest }) => adminApi.updateUserStatus(userId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  })
}
