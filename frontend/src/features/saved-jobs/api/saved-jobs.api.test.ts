import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import { savedJobsApi } from './saved-jobs.api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('savedJobsApi', () => {
  it('uses a bodyless PUT when saving a job', async () => {
    let body: unknown = 'not-empty'
    apiClient.defaults.adapter = (async (config) => {
      body = config.data
      return { data: undefined, status: 204, statusText: 'No Content', headers: {}, config } as AxiosResponse
    }) satisfies AxiosAdapter
    await savedJobsApi.saveJob('job-1')
    expect(body).toBeUndefined()
  })
})
