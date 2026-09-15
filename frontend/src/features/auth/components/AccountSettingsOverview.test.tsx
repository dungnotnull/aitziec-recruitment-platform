import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { AuthSession, CompanyMembership, HrInvitationItem, HrProfile, PaginatedResponse, SuccessResponse } from '@/api/types'
import { AuthProvider } from '@/features/auth/context'
import { AccountSettingsOverview } from './AccountSettingsOverview'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('AccountSettingsOverview', () => {
  const hrSession: AuthSession = {
    accessToken: 'hr-test-token',
    accessTokenExpiresAt: '2026-09-14T18:00:00.000Z',
    user: {
      id: 'hr-user-1',
      email: 'hr.candidate@example.com',
      role: 'HR',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  }

  const initialProfile: HrProfile = {
    id: 'prof-1',
    userId: 'hr-user-1',
    firstName: 'Jane',
    lastName: 'Recruiter',
    avatarUrl: null,
    phone: '+84912345678',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }

  const pendingInvitation: HrInvitationItem = {
    id: 'inv-123',
    company: {
      id: 'comp-target-1',
      slug: 'awesome-startup',
      name: 'Awesome Startup Inc',
      logoUrl: null,
    },
    role: 'RECRUITER',
    status: 'PENDING',
    expiresAt: '2026-09-21T00:00:00.000Z',
    createdAt: '2026-09-14T00:00:00.000Z',
  }

  it('renders pending company invitations from real API and accepts using token', async () => {
    const requests: Array<{ method?: string; url?: string; data?: string }> = []

    const acceptedMembership: CompanyMembership = {
      id: 'mem-new-1',
      companyId: 'comp-target-1',
      user: {
        id: 'hr-user-1',
        email: 'hr.candidate@example.com',
        role: 'HR',
        status: 'ACTIVE',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      role: 'RECRUITER',
      createdAt: '2026-09-14T00:00:00.000Z',
    }

    apiClient.defaults.adapter = (async (config) => {
      requests.push({ method: config.method, url: config.url, data: config.data })

      if (config.url === '/auth/refresh') {
        return {
          data: { data: hrSession },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<AuthSession>>
      }

      if (config.url === '/hr/me') {
        return {
          data: { data: initialProfile },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<HrProfile>>
      }

      if (config.url === '/hr/invitations') {
        return {
          data: {
            data: [pendingInvitation],
            meta: { page: { nextCursor: null, hasNextPage: false, limit: 20 } },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<PaginatedResponse<HrInvitationItem>>
      }

      if (config.url === '/company-invitations/valid-test-token/accept' && config.method === 'post') {
        return {
          data: { data: acceptedMembership },
          status: 201,
          statusText: 'Created',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<CompanyMembership>>
      }

      return {
        data: { data: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse
    }) satisfies AxiosAdapter

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AccountSettingsOverview />
        </AuthProvider>
      </QueryClientProvider>,
    )

    // Verify company invitation from real API is rendered
    expect(await screen.findByText('Awesome Startup Inc')).toBeVisible()
    expect(screen.getByText(/invited you to join as/i)).toBeVisible()

    // Accept via token dialog
    const openDialogBtn = screen.getByRole('button', { name: /enter token to accept/i })
    await userEvent.click(openDialogBtn)

    const tokenInput = screen.getByPlaceholderText(/invitation token/i)
    await userEvent.type(tokenInput, 'valid-test-token')

    const confirmAcceptBtn = screen.getByRole('button', { name: 'Accept Invitation' })
    await userEvent.click(confirmAcceptBtn)

    // Verify POST was made
    const acceptReq = requests.find((r) => r.url === '/company-invitations/valid-test-token/accept')
    expect(acceptReq).toBeDefined()
    expect(acceptReq?.method).toBe('post')

    // Verify success banner and link to company
    expect(await screen.findByText(/invitation accepted successfully/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /view company/i })).toBeVisible()
  })

  it('renders and updates HR personal profile including avatarUrl', async () => {
    const requests: Array<{ method?: string; url?: string; data?: unknown }> = []

    const profileWithAvatar: HrProfile = {
      ...initialProfile,
      avatarUrl: 'https://example.com/current-avatar.png',
    }

    apiClient.defaults.adapter = (async (config) => {
      let parsedData = config.data
      if (typeof config.data === 'string') {
        try {
          parsedData = JSON.parse(config.data)
        } catch {
          // ignore
        }
      }
      requests.push({ method: config.method, url: config.url, data: parsedData })

      if (config.url === '/auth/refresh') {
        return {
          data: { data: hrSession },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<AuthSession>>
      }

      if (config.url === '/hr/me' && (config.method === 'get' || !config.method)) {
        return {
          data: { data: profileWithAvatar },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<HrProfile>>
      }

      if (config.url === '/hr/me' && config.method === 'patch') {
        return {
          data: {
            data: {
              ...profileWithAvatar,
              avatarUrl: 'https://cdn.example.com/new-avatar.png',
              version: 2,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<HrProfile>>
      }

      if (config.url === '/hr/invitations') {
        return {
          data: {
            data: [],
            meta: { page: { nextCursor: null, hasNextPage: false, limit: 20 } },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<PaginatedResponse<HrInvitationItem>>
      }

      return {
        data: { data: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse
    }) satisfies AxiosAdapter

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AccountSettingsOverview />
        </AuthProvider>
      </QueryClientProvider>,
    )

    // Verify avatarUrl input is populated with initial value
    const avatarInput = (await screen.findByLabelText(/avatar url/i)) as HTMLInputElement
    await waitFor(() => {
      expect(avatarInput.value).toBe('https://example.com/current-avatar.png')
    })

    // Change avatarUrl
    await userEvent.clear(avatarInput)
    await userEvent.type(avatarInput, 'https://cdn.example.com/new-avatar.png')

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    await userEvent.click(saveBtn)

    // Verify PATCH request payload
    const patchReq = requests.find((r) => r.url === '/hr/me' && r.method === 'patch')
    expect(patchReq).toBeDefined()
    expect(patchReq?.data).toMatchObject({
      expectedVersion: 1,
      firstName: 'Jane',
      lastName: 'Recruiter',
      phone: '+84912345678',
      avatarUrl: 'https://cdn.example.com/new-avatar.png',
    })

    // Verify success banner
    expect(await screen.findByText(/personal information updated successfully/i)).toBeVisible()
  })
})
