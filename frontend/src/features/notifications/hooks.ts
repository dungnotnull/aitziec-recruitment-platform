import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import type { Notification, NotificationFilters, NotificationPageResponse } from '@/api/types'
import { notificationApi } from './api'

type NotificationPages = InfiniteData<NotificationPageResponse, string | undefined>

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: Omit<NotificationFilters, 'cursor'>) => [...notificationKeys.lists(), filters] as const,
  unreadSummary: () => [...notificationKeys.all, 'unread-summary'] as const,
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

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markRead(notificationId, true),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() })
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadSummary() })

      const snapshots = queryClient.getQueriesData<NotificationPages>({ queryKey: notificationKeys.lists() })
      const unreadSnapshot = queryClient.getQueryData<NotificationPageResponse>(notificationKeys.unreadSummary())

      queryClient.setQueriesData<NotificationPages>({ queryKey: notificationKeys.lists() }, (current) =>
        replaceNotification(current, notificationId, (notification) => ({
          ...notification,
          readAt: new Date().toISOString(),
        })),
      )

      queryClient.setQueryData<NotificationPageResponse>(notificationKeys.unreadSummary(), (current) => {
        if (!current) return current
        return {
          ...current,
          meta: {
            ...current.meta,
            unreadCount: Math.max(0, (current.meta.unreadCount ?? 0) - 1),
          },
        }
      })

      return { snapshots, unreadSnapshot }
    },
    onError: (_error, _variables, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
      if (context?.unreadSnapshot) {
        queryClient.setQueryData(notificationKeys.unreadSummary(), context.unreadSnapshot)
      }
    },
    onSuccess: ({ data }) => {
      queryClient.setQueriesData<NotificationPages>({ queryKey: notificationKeys.lists() }, (current) =>
        replaceNotification(current, data.id, () => data),
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
