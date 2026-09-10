import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { Notification, PaginatedResponse, SuccessResponse } from '@/api/types'
import { notificationApi } from './api'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('notificationApi', () => {
  it('sends contract read and cursor filters to the owner collection', async () => {
    let requestedUrl = ''
    let requestedParams: unknown
    apiClient.defaults.adapter = (async (config) => {
      requestedUrl = config.url ?? ''
      requestedParams = config.params
      return {
        data: { data: [], meta: { page: { nextCursor: null, hasNextPage: false, limit: 20 } } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse<PaginatedResponse<Notification>>
    }) satisfies AxiosAdapter

    await notificationApi.list({ read: false, cursor: 'next-1', limit: 20 })

    expect(requestedUrl).toBe('/notifications')
    expect(requestedParams).toEqual({ read: false, cursor: 'next-1', limit: 20 })
  })

  it('sets read state through the contracted patch payload', async () => {
    let requestData = ''
    apiClient.defaults.adapter = (async (config) => {
      requestData = String(config.data)
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

    await notificationApi.setRead('notification-1', true)

    expect(requestData).toBe(JSON.stringify({ read: true }))
  })
})
