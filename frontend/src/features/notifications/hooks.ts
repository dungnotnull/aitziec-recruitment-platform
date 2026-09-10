import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import type { Notification, NotificationFilters, PaginatedResponse } from '@/api/types'
import { notificationApi } from './api'

type NotificationPages = InfiniteData<PaginatedResponse<Notification>, string | undefined>

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: Omit<NotificationFilters, 'cursor'>) => [...notificationKeys.lists(), filters] as const,
}

function replaceNotification(
  current: NotificationPages | undefined,
  notificationId: string,
  update: (notification: Notification) => Notification,
): NotificationPages | undefined {
  if (!current) return current
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((notification) =>
        notification.id === notificationId ? update(notification) : notification,
      ),
    })),
  }
}

export function useNotifications(filters: Omit<NotificationFilters, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => notificationApi.list({ ...filters, cursor: pageParam }, signal),
    getNextPageParam: (lastPage) => lastPage.meta.page.hasNextPage
      ? lastPage.meta.page.nextCursor ?? undefined
      : undefined,
  })
}

export function useSetNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ notificationId, read }: { notificationId: string; read: boolean }) =>
      notificationApi.setRead(notificationId, read),
    onMutate: async ({ notificationId, read }) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() })
      const snapshots = queryClient.getQueriesData<NotificationPages>({ queryKey: notificationKeys.lists() })
      queryClient.setQueriesData<NotificationPages>({ queryKey: notificationKeys.lists() }, (current) =>
        replaceNotification(current, notificationId, (notification) => ({
          ...notification,
          readAt: read ? new Date().toISOString() : null,
        })),
      )
      return { snapshots }
    },
    onError: (_error, _variables, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSuccess: ({ data }) => {
      queryClient.setQueriesData<NotificationPages>({ queryKey: notificationKeys.lists() }, (current) =>
        replaceNotification(current, data.id, () => data),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.lists() }),
  })
}
