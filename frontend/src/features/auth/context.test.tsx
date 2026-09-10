import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { AuthSession, SuccessResponse } from '@/api/types'
import { AuthProvider, useAuth } from './context'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function AuthStateProbe() {
  const auth = useAuth()
  return <p>{auth.status}:{auth.session?.user.email ?? 'none'}</p>
}

describe('AuthProvider bootstrap', () => {
  it('waits for the real refresh response before exposing an authenticated identity', async () => {
    const session: AuthSession = {
      accessToken: 'short-lived-test-token',
      accessTokenExpiresAt: '2026-09-10T00:15:00.000Z',
      user: {
        id: 'user-1', email: 'candidate@example.com', role: 'CANDIDATE', status: 'ACTIVE',
        createdAt: '2026-09-10T00:00:00.000Z',
      },
    }
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: session }, status: 200, statusText: 'OK', headers: {}, config,
    }) as AxiosResponse<SuccessResponse<AuthSession>>) satisfies AxiosAdapter

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider><AuthStateProbe /></AuthProvider>
      </QueryClientProvider>,
    )

    expect(screen.getByText('loading:none')).toBeVisible()
    expect(await screen.findByText('authenticated:candidate@example.com')).toBeVisible()
  })

  it('completes bootstrap when React StrictMode replays effects', async () => {
    const session: AuthSession = {
      accessToken: 'strict-mode-token',
      accessTokenExpiresAt: '2026-09-10T00:15:00.000Z',
      user: {
        id: 'user-2', email: 'strict@example.com', role: 'HR', status: 'ACTIVE',
        createdAt: '2026-09-10T00:00:00.000Z',
      },
    }
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: session }, status: 200, statusText: 'OK', headers: {}, config,
    }) as AxiosResponse<SuccessResponse<AuthSession>>) satisfies AxiosAdapter
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <AuthProvider><AuthStateProbe /></AuthProvider>
        </QueryClientProvider>
      </StrictMode>,
    )

    expect(await screen.findByText('authenticated:strict@example.com')).toBeVisible()
  })
})
