import { apiClient } from '@/api/client'
import type { Notification, NotificationFilters, NotificationPageResponse, NotificationTransport, SuccessResponse } from '@/api/types'

type BackendNotificationMeta = {
  page?: {
    hasNextPage: boolean
    nextCursor: string | null
    limit: number
  }
  hasMore?: boolean
  nextCursor?: string | null
  total?: number
  unreadCount?: number
  requestId?: string
}

type NotificationRawResponse = {
  data: (Notification | NotificationTransport)[]
  meta: BackendNotificationMeta
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
    const response = await apiClient.get<NotificationRawResponse>('/notifications', {
      params: filters,
      signal,
    })
    const rawMeta = response.data.meta || {}
    const hasNextPage = rawMeta.page?.hasNextPage ?? rawMeta.hasMore ?? false
    const nextCursor = rawMeta.page?.nextCursor ?? rawMeta.nextCursor ?? null
    const limit = rawMeta.page?.limit ?? filters.limit ?? 20
    const unreadCount = rawMeta.unreadCount ?? 0

    return {
      data: response.data.data.map(toNotification),
      meta: {
        ...(rawMeta.requestId ? { requestId: rawMeta.requestId } : {}),
        total: rawMeta.total,
        unreadCount,
        page: {
          hasNextPage,
          nextCursor,
          limit,
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
