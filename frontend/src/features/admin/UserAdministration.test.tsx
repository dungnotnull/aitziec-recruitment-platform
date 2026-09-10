import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { PaginatedResponse, SuccessResponse, UserSummary } from '@/api/types'
import { UserAdministration } from './UserAdministration'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('UserAdministration', () => {
  it('requires a reason and exposes the consequence before moderation', async () => {
    let user: UserSummary = { id: 'user-1', email: 'candidate@example.com', role: 'CANDIDATE', status: 'ACTIVE', createdAt: '2026-09-01T00:00:00.000Z' }
    apiClient.defaults.adapter = (async (config) => {
      if (config.method === 'patch') {
        user = { ...user, status: 'SUSPENDED' }
        return { data: { data: user }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<SuccessResponse<UserSummary>>
      }
      return { data: { data: [user], meta: { page: { nextCursor: null, hasNextPage: false, limit: 20 } } }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<PaginatedResponse<UserSummary>>
    }) satisfies AxiosAdapter
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><UserAdministration /></QueryClientProvider>)

    const [suspendButton] = await screen.findAllByRole('button', { name: 'Suspend candidate@example.com' })
    await userEvent.click(suspendButton)
    expect(screen.getByText(/active sessions may stop working/i)).toBeVisible()
    const confirm = screen.getByRole('button', { name: 'Confirm suspension' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Moderation reason'), 'Policy breach')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect((await screen.findAllByText('SUSPENDED'))[0]).toBeVisible()
  })
})
