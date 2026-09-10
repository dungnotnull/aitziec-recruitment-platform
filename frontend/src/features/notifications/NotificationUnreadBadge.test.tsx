import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import { NotificationUnreadBadge } from './NotificationUnreadBadge'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('NotificationUnreadBadge', () => {
  it('shows the server-owned unread count without fabricating totals', async () => {
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: [], meta: { hasMore: false, nextCursor: null, total: 7, unreadCount: 3 } },
      status: 200, statusText: 'OK', headers: {}, config,
    }) as AxiosResponse) satisfies AxiosAdapter
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><NotificationUnreadBadge /></QueryClientProvider>)
    expect(await screen.findByLabelText('3 unread notifications')).toBeVisible()
  })
})
