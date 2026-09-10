import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { Interview, SuccessResponse } from '@/api/types'
import { interviewApi } from './interview.api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('interviewApi', () => {
  it('normalizes the backend interview cursor metadata', async () => {
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: [], meta: { hasMore: true, nextCursor: 'next-1', total: 4 } },
      status: 200, statusText: 'OK', headers: {}, config,
    }) as AxiosResponse) satisfies AxiosAdapter

    const response = await interviewApi.getInterviews('application-1')

    expect(response.meta.page).toEqual({ hasNextPage: true, nextCursor: 'next-1', limit: 20 })
  })

  it('loads interview detail from the backend detail route', async () => {
    let url = ''
    const interview = { id: 'interview-1' } as Interview
    apiClient.defaults.adapter = (async (config) => {
      url = config.url ?? ''
      return { data: { data: interview }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<SuccessResponse<Interview>>
    }) satisfies AxiosAdapter

    const response = await interviewApi.getInterview('interview-1')

    expect(url).toBe('/interviews/interview-1')
    expect(response.data).toBe(interview)
  })

  it('sends the exact cancellation payload', async () => {
    let body = ''
    apiClient.defaults.adapter = (async (config) => {
      body = String(config.data)
      return { data: { data: {} as Interview }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<SuccessResponse<Interview>>
    }) satisfies AxiosAdapter

    await interviewApi.cancelInterview('interview-1', 3, 'Candidate withdrew')

    expect(JSON.parse(body)).toEqual({ expectedVersion: 3, reason: 'Candidate withdrew' })
  })
})
