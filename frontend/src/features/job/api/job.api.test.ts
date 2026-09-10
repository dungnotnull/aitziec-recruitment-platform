import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { Job, SuccessResponse } from '@/api/types'
import { jobApi } from './job.api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('jobApi backend mapping', () => {
  it('serializes array filters as repeated backend query keys', () => {
    expect(apiClient.getUri({ url: '/jobs', params: { experienceLevel: ['FRESHER', 'JUNIOR'] } }))
      .toContain('experienceLevel=FRESHER&experienceLevel=JUNIOR')
  })

  it('omits an absent close reason from the lifecycle payload', async () => {
    let body = ''
    apiClient.defaults.adapter = (async (config) => {
      body = String(config.data)
      return { data: { data: {} as Job }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<SuccessResponse<Job>>
    }) satisfies AxiosAdapter
    await jobApi.closeJob('job-1', 2)
    expect(JSON.parse(body)).toEqual({ expectedVersion: 2 })
  })
})
