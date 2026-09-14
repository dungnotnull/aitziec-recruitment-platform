import { apiClient } from '@/api/client'
import type { Notification, NotificationFilters, NotificationPageResponse, NotificationTransport, SuccessResponse } from '@/api/types'

type NotificationTransportPage = {
  data: NotificationTransport[]
  meta: {
    hasMore: boolean
    nextCursor: string | null
    total: number
    unreadCount: number
    requestId?: string
  }
}

export function toNotification(
  dto: NotificationTransport | (Omit<Notification, 'resource'> & { resource?: { type: string; id: string } | null; userId?: string; resourceType?: string | null; resourceId?: string | null })
): Notification {
  if ('resource' in dto && dto.resource !== undefined) {
    const { userId: _userId, resourceType: _rt, resourceId: _ri, ...rest } = dto as any
    return rest as Notification
  }
  const { userId: _userId, resourceType, resourceId, ...notification } = dto as NotificationTransport
  return {
    ...notification,
    resource: resourceType && resourceId ? { type: resourceType, id: resourceId } : null,
  }
}

export const notificationApi = {
  async list(filters: NotificationFilters, signal?: AbortSignal): Promise<NotificationPageResponse> {
    const response = await apiClient.get<NotificationTransportPage>('/notifications', {
      params: filters,
      signal,
    })
    const { hasMore, nextCursor, total, unreadCount, requestId } = response.data.meta
    return {
      data: response.data.data.map(toNotification),
      meta: {
        ...(requestId ? { requestId } : {}),
        total,
        unreadCount,
        page: {
          hasNextPage: hasMore,
          nextCursor,
          limit: filters.limit ?? 20,
        },
      },
    }
  },

  async markRead(notificationId: string, read = true): Promise<SuccessResponse<Notification>> {
    const response = await apiClient.patch<SuccessResponse<NotificationTransport>>(
      `/notifications/${encodeURIComponent(notificationId)}/read`,
      { read },
    )
    return { ...response.data, data: toNotification(response.data.data) }
  },
}
