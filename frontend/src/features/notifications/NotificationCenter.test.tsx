import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { NotificationTransport, SuccessResponse } from '@/api/types'
import { NotificationCenter } from './NotificationCenter'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('NotificationCenter', () => {
  it('renders real API data and synchronizes an optimistic read action', async () => {
    let notification: NotificationTransport = {
      id: 'notification-1',
      userId: 'user-1',
      type: 'INTERVIEW_SCHEDULED',
      title: 'Interview scheduled',
      body: 'Review the time and location.',
      resourceType: null,
      resourceId: null,
      readAt: null,
      createdAt: '2026-09-09T01:00:00.000Z',
    }
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'patch') {
        notification = { ...notification, readAt: '2026-09-09T02:00:00.000Z' }
        return { data: { data: notification }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<SuccessResponse<NotificationTransport>>
      }
      return {
        data: { data: [notification], meta: { hasMore: false, nextCursor: null, total: 1, unreadCount: notification.readAt ? 0 : 1 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse
    }) satisfies AxiosAdapter

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><NotificationCenter /></QueryClientProvider>)

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeVisible()
    expect(await screen.findByText('Review the time and location.')).toBeVisible()

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Mark Interview scheduled as read' }))
    })

    expect(screen.queryByRole('button', { name: /Mark Interview scheduled/ })).not.toBeInTheDocument()
  })

  it('rolls an optimistic read change back when the real API rejects it', async () => {
    const notification: NotificationTransport = {
      id: 'notification-2', type: 'APPLICATION_STATUS_CHANGED', title: 'Application updated',
      userId: 'user-1', body: 'The status changed.', resourceType: null, resourceId: null, readAt: null,
      createdAt: '2026-09-09T01:00:00.000Z',
    }
    let rejectPatch: ((reason: Error) => void) | undefined
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'patch') {
        return new Promise((_resolve, reject) => { rejectPatch = reject })
      }
      return {
        data: { data: [notification], meta: { hasMore: false, nextCursor: null, total: 1, unreadCount: 1 } },
        status: 200, statusText: 'OK', headers: {}, config,
      } as AxiosResponse
    }) satisfies AxiosAdapter
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><NotificationCenter /></QueryClientProvider>)

    await userEvent.click(await screen.findByRole('button', { name: 'Mark Application updated as read' }))
    expect(screen.queryByRole('button', { name: /Mark Application updated/ })).not.toBeInTheDocument()
    rejectPatch?.(new Error('denied'))

    expect(await screen.findByRole('button', { name: 'Mark Application updated as read' })).toBeVisible()
  })
})
