import { apiClient } from '@/api/client'
import type { Notification, NotificationFilters, PaginatedResponse, SuccessResponse } from '@/api/types'

export const notificationApi = {
  async list(filters: NotificationFilters, signal?: AbortSignal): Promise<PaginatedResponse<Notification>> {
    const response = await apiClient.get<PaginatedResponse<Notification>>('/notifications', {
      params: filters,
      signal,
    })
    return response.data
  },

  async setRead(notificationId: string, read: boolean): Promise<SuccessResponse<Notification>> {
    const response = await apiClient.patch<SuccessResponse<Notification>>(
      `/notifications/${encodeURIComponent(notificationId)}/read`,
      { read },
    )
    return response.data
  },
}
