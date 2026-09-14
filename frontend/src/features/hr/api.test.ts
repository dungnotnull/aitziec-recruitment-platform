import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { HrInvitationItem, HrProfile, PaginatedResponse, SuccessResponse } from '@/api/types'
import { listMyHrInvitations, getMyHrProfile, updateMyHrProfile } from './api'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('HR Profile and Invitations API', () => {
  it('calls GET /hr/invitations to fetch pending invitations for current HR', async () => {
    const requests: Array<{ method?: string; url?: string }> = []
    const mockInvitations: HrInvitationItem[] = [
      {
        id: 'inv-1',
        company: {
          id: 'comp-1',
          slug: 'acme-corp',
          name: 'Acme Corp',
          logoUrl: null,
        },
        role: 'RECRUITER',
        status: 'PENDING',
        expiresAt: '2026-09-21T00:00:00.000Z',
        createdAt: '2026-09-14T00:00:00.000Z',
      },
    ]

    apiClient.defaults.adapter = (async (config) => {
      requests.push({ method: config.method, url: config.url })
      return {
        data: {
          data: mockInvitations,
          meta: {
            requestId: 'req-inv-1',
            page: { nextCursor: null, hasNextPage: false, limit: 20 },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse<PaginatedResponse<HrInvitationItem>>
    }) satisfies AxiosAdapter

    const response = await listMyHrInvitations()

    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('get')
    expect(requests[0].url).toBe('/hr/invitations')
    expect(response.data).toEqual(mockInvitations)
  })

  it('calls GET /hr/me and PATCH /hr/me for HR profile management', async () => {
    const requests: Array<{ method?: string; url?: string; data?: string }> = []
    const mockProfile: HrProfile = {
      id: 'prof-1',
      userId: 'user-1',
      firstName: 'Jane',
      lastName: 'Doe',
      avatarUrl: null,
      phone: '+84987654321',
      version: 1,
      createdAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
    }

    apiClient.defaults.adapter = (async (config) => {
      requests.push({ method: config.method, url: config.url, data: config.data })
      return {
        data: {
          data: mockProfile,
          meta: { requestId: 'req-prof-1' },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse<SuccessResponse<HrProfile>>
    }) satisfies AxiosAdapter

    const getRes = await getMyHrProfile()
    expect(getRes).toEqual(mockProfile)

    const patchRes = await updateMyHrProfile({
      expectedVersion: 1,
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+84987654321',
    })
    expect(patchRes).toEqual(mockProfile)

    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'get /hr/me',
      'patch /hr/me',
    ])
  })
})
