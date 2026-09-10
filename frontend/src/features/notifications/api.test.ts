import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { Notification, SuccessResponse } from '@/api/types'
import { notificationApi, toNotification } from './api'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('notificationApi', () => {
  it('maps the flat backend resource pair to the presentation resource', () => {
    expect(toNotification({
      id: 'notification-1', userId: 'user-1', type: 'INTERVIEW_SCHEDULED',
      title: 'Interview scheduled', body: 'Review the schedule',
      resourceType: 'INTERVIEW', resourceId: 'interview-1', readAt: null,
      createdAt: '2026-09-10T00:00:00.000Z',
    })).toMatchObject({
      id: 'notification-1',
      resource: { type: 'INTERVIEW', id: 'interview-1' },
    })
  })

  it('does not create a resource from a partial backend pair', () => {
    expect(toNotification({
      id: 'notification-1', userId: 'user-1', type: 'INTERVIEW_SCHEDULED',
      title: 'Interview scheduled', body: 'Review the schedule',
      resourceType: 'INTERVIEW', resourceId: null, readAt: null,
      createdAt: '2026-09-10T00:00:00.000Z',
    }).resource).toBeNull()
  })
  it('sends contract read and cursor filters to the owner collection', async () => {
    let requestedUrl = ''
    let requestedParams: unknown
    apiClient.defaults.adapter = (async (config) => {
      requestedUrl = config.url ?? ''
      requestedParams = config.params
      return {
        data: { data: [], meta: { hasMore: true, nextCursor: 'next-2', total: 3, unreadCount: 2 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse
    }) satisfies AxiosAdapter

    const response = await notificationApi.list({ read: false, cursor: 'next-1', limit: 20 })

    expect(requestedUrl).toBe('/notifications')
    expect(requestedParams).toEqual({ read: false, cursor: 'next-1', limit: 20 })
    expect(response.meta).toMatchObject({
      unreadCount: 2,
      total: 3,
      page: { nextCursor: 'next-2', hasNextPage: true, limit: 20 },
    })
  })

  it('marks read through the bodyless backend patch route', async () => {
    let requestData: unknown = 'not-empty'
    apiClient.defaults.adapter = (async (config) => {
      requestData = config.data
      const notification = {
        id: 'notification-1',
        type: 'INTERVIEW_SCHEDULED',
        title: 'Interview scheduled',
        body: 'Your interview is ready to review.',
        resource: null,
        readAt: '2026-09-09T02:00:00.000Z',
        createdAt: '2026-09-09T01:00:00.000Z',
      } satisfies Notification
      return { data: { data: notification }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<SuccessResponse<Notification>>
    }) satisfies AxiosAdapter

    await notificationApi.markRead('notification-1')

    expect(requestData).toBeUndefined()
  })
})
