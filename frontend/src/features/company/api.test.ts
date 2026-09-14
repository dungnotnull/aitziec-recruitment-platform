import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { CompanyInvitation, CompanyMembership, SuccessResponse } from '@/api/types'
import { addMember, acceptCompanyInvitation } from './api'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('Company Invitation and Membership API', () => {
  it('calls POST /companies/:companyId/members with normalized email and role to invite recruiter', async () => {
    const requests: Array<{ method?: string; url?: string; data?: string }> = []
    const mockInvitation: CompanyInvitation = {
      id: 'inv-uuid-1',
      companyId: 'comp-1',
      email: 'h***r@example.com',
      role: 'RECRUITER',
      status: 'PENDING',
      expiresAt: '2026-09-21T00:00:00.000Z',
      createdAt: '2026-09-14T00:00:00.000Z',
    }

    apiClient.defaults.adapter = (async (config) => {
      requests.push({ method: config.method, url: config.url, data: config.data })
      return {
        data: { data: mockInvitation, meta: { requestId: 'req-1' } },
        status: 202,
        statusText: 'Accepted',
        headers: {},
        config,
      } as AxiosResponse<SuccessResponse<CompanyInvitation>>
    }) satisfies AxiosAdapter

    const result = await addMember('comp-1', {
      userEmail: 'hr@example.com',
      role: 'RECRUITER',
    })

    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('post')
    expect(requests[0].url).toBe('/companies/comp-1/members')
    expect(JSON.parse(requests[0].data || '{}')).toEqual({
      userEmail: 'hr@example.com',
      role: 'RECRUITER',
    })
    expect(result).toEqual(mockInvitation)
  })

  it('calls POST /company-invitations/:token/accept to accept invitation and create membership', async () => {
    const requests: Array<{ method?: string; url?: string }> = []
    const mockMembership: CompanyMembership = {
      id: 'mem-1',
      companyId: 'comp-1',
      user: {
        id: 'user-hr-1',
        email: 'hr@example.com',
        role: 'HR',
        status: 'ACTIVE',
        createdAt: '2026-09-10T00:00:00.000Z',
      },
      role: 'RECRUITER',
      createdAt: '2026-09-14T00:00:00.000Z',
    }

    apiClient.defaults.adapter = (async (config) => {
      requests.push({ method: config.method, url: config.url })
      return {
        data: { data: mockMembership, meta: { requestId: 'req-2' } },
        status: 201,
        statusText: 'Created',
        headers: {},
        config,
      } as AxiosResponse<SuccessResponse<CompanyMembership>>
    }) satisfies AxiosAdapter

    const result = await acceptCompanyInvitation('token-abc-123')

    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('post')
    expect(requests[0].url).toBe('/company-invitations/token-abc-123/accept')
    expect(result).toEqual(mockMembership)
  })
})
