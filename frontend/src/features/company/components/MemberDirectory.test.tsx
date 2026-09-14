import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { AuthSession, CompanyInvitation, CompanyMembership, PaginatedResponse, SuccessResponse } from '@/api/types'
import { AuthProvider } from '@/features/auth/context'
import { MemberDirectory } from './MemberDirectory'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('MemberDirectory', () => {
  const hrOwnerSession: AuthSession = {
    accessToken: 'test-token',
    accessTokenExpiresAt: '2026-09-14T18:00:00.000Z',
    user: {
      id: 'owner-1',
      email: 'owner@example.com',
      role: 'HR',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  }

  const existingMember: CompanyMembership = {
    id: 'mem-owner-1',
    companyId: 'comp-1',
    user: {
      id: 'owner-1',
      email: 'owner@example.com',
      role: 'HR',
      status: 'ACTIVE',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    role: 'OWNER',
    createdAt: '2026-09-01T00:00:00.000Z',
  }

  it('renders team directory and allows owner to send pending invitation with real API', async () => {
    const requests: Array<{ method?: string; url?: string; data?: string }> = []

    const newInvitation: CompanyInvitation = {
      id: 'inv-new-1',
      companyId: 'comp-1',
      email: 'n***r@example.com',
      role: 'RECRUITER',
      status: 'PENDING',
      expiresAt: '2026-09-21T00:00:00.000Z',
      createdAt: '2026-09-14T00:00:00.000Z',
    }

    apiClient.defaults.adapter = (async (config) => {
      requests.push({ method: config.method, url: config.url, data: config.data })

      if (config.url === '/auth/refresh') {
        return {
          data: { data: hrOwnerSession },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<AuthSession>>
      }

      if (config.url === '/companies/comp-1/members' && config.method === 'post') {
        return {
          data: { data: newInvitation, meta: { requestId: 'req-inv' } },
          status: 202,
          statusText: 'Accepted',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<CompanyInvitation>>
      }

      if (config.url === '/companies/comp-1/members' && config.method === 'get') {
        return {
          data: {
            data: [existingMember],
            meta: { page: { nextCursor: null, hasNextPage: false, limit: 20 } },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<PaginatedResponse<CompanyMembership>>
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
          <MemberDirectory companyId="comp-1" />
        </AuthProvider>
      </QueryClientProvider>,
    )

    // Wait for members list to display
    expect(await screen.findByText('owner@example.com')).toBeVisible()

    // Click Invite Member button
    const inviteButton = screen.getByRole('button', { name: /invite member/i })
    await userEvent.click(inviteButton)

    // Type email in dialog input
    const emailInput = screen.getByPlaceholderText(/recruiter email address/i)
    await userEvent.type(emailInput, 'newrecruiter@example.com')

    // Submit invite
    const sendButton = screen.getByRole('button', { name: /send invite/i })
    await userEvent.click(sendButton)

    // Check that real POST was issued
    const postReq = requests.find((r) => r.method === 'post' && r.url === '/companies/comp-1/members')
    expect(postReq).toBeDefined()
    expect(JSON.parse(postReq?.data || '{}')).toEqual({
      userEmail: 'newrecruiter@example.com',
      role: 'RECRUITER',
    })

    // Success notice and pending invitations section visible
    expect(await screen.findByText(/invitation sent to newrecruiter@example.com/i)).toBeVisible()
    expect(screen.getByText('n***r@example.com')).toBeVisible()
  })

  it('displays API error message when invitation is rejected', async () => {
    apiClient.defaults.adapter = (async (config) => {
      if (config.url === '/auth/refresh') {
        return {
          data: { data: hrOwnerSession },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<AuthSession>>
      }

      if (config.url === '/companies/comp-1/members' && config.method === 'get') {
        return {
          data: {
            data: [existingMember],
            meta: { page: { nextCursor: null, hasNextPage: false, limit: 20 } },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<PaginatedResponse<CompanyMembership>>
      }

      if (config.url === '/companies/comp-1/members' && config.method === 'post') {
        return Promise.reject({
          isAxiosError: true,
          response: {
            status: 400,
            data: {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Only active HR accounts can be invited to a company.',
              },
            },
          },
          config,
        })
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
          <MemberDirectory companyId="comp-1" />
        </AuthProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('owner@example.com')).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: /invite member/i }))
    await userEvent.type(
      screen.getByPlaceholderText(/recruiter email address/i),
      'candidate@example.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }))

    expect(
      await screen.findByText('Only active HR accounts can be invited to a company.'),
    ).toBeVisible()
  })
})
