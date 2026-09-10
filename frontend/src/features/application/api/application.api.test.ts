import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { ApplicationDetail, PaginatedResponse } from '@/api/types'
import { applicationApi } from './application.api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('applicationApi', () => {
  it('omits absent collection filters', async () => {
    let params: unknown
    apiClient.defaults.adapter = (async (config) => {
      params = config.params
      return {
        data: { data: [], meta: { page: { nextCursor: null, hasNextPage: false, limit: 20 } } },
        status: 200, statusText: 'OK', headers: {}, config,
      } as AxiosResponse<PaginatedResponse<ApplicationDetail>>
    }) satisfies AxiosAdapter

    await applicationApi.getCandidateApplications(undefined, 'cursor-1')

    expect(params).toEqual({ cursor: 'cursor-1' })
  })
})
