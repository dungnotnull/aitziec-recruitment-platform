import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { AuthSession, SuccessResponse, UserSummary } from '@/api/types'
import { getCurrentUser, logoutAllSessions, refreshSession } from './api'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('auth backend mapping', () => {
  it('uses the implemented refresh, current-user, and logout-all routes', async () => {
    const requests: Array<{ method?: string; url?: string; data?: unknown }> = []
    const user: UserSummary = {
      id: 'user-1', email: 'candidate@example.com', role: 'CANDIDATE', status: 'ACTIVE',
      createdAt: '2026-09-10T00:00:00.000Z',
    }
    const session: AuthSession = {
      accessToken: 'short-lived-test-token',
      accessTokenExpiresAt: '2026-09-10T00:15:00.000Z',
      user,
    }
    apiClient.defaults.adapter = (async (config) => {
      requests.push({ method: config.method, url: config.url, data: config.data })
      const data = config.url === '/auth/me' ? user : session
      return { data: { data }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<SuccessResponse<AuthSession | UserSummary>>
    }) satisfies AxiosAdapter

    await refreshSession()
    await getCurrentUser()
    await logoutAllSessions()

    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'post /auth/refresh',
      'get /auth/me',
      'post /auth/logout-all',
    ])
  })
})
