import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { Cv, Operation, SuccessResponse } from '@/api/types'
import { cvApi } from './cv.api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('cvApi', () => {
  it('lets the browser add the multipart boundary', async () => {
    let contentType: unknown
    apiClient.defaults.adapter = (async (config) => {
      contentType = config.headers.get('Content-Type')
      return {
        data: { data: { cv: {} as Cv, operation: {} as Operation } },
        status: 201, statusText: 'Created', headers: {}, config,
      } as AxiosResponse<SuccessResponse<{ cv: Cv; operation: Operation }>>
    }) satisfies AxiosAdapter

    await cvApi.uploadCv(new File(['resume'], 'resume.pdf', { type: 'application/pdf' }))

    expect(contentType).not.toBe('multipart/form-data')
  })
})
