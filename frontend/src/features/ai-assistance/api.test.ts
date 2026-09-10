import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { Operation, SuccessResponse } from '@/api/types'
import { aiApi } from './api'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('aiApi', () => {
  it('creates CV-to-job analysis with exact contract payload and idempotency key', async () => {
    let requestData = ''
    let idempotencyKey: unknown
    const operation: Operation = {
      id: 'operation-1', type: 'CV_JOB_ANALYSIS', status: 'QUEUED', progressPercent: null,
      resultResource: null, failure: null, createdAt: '2026-09-09T01:00:00.000Z',
      updatedAt: '2026-09-09T01:00:00.000Z', completedAt: null,
    }
    apiClient.defaults.adapter = (async (config) => {
      requestData = String(config.data)
      idempotencyKey = config.headers.get('Idempotency-Key')
      return { data: { data: operation }, status: 202, statusText: 'Accepted', headers: {}, config } as AxiosResponse<SuccessResponse<Operation>>
    }) satisfies AxiosAdapter

    await aiApi.createCvJobAnalysis({
      cvId: 'cv-1', jobId: 'job-1', analyses: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'],
    }, 'action-key')

    expect(JSON.parse(requestData)).toEqual({
      cvId: 'cv-1', jobId: 'job-1', analyses: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'],
    })
    expect(idempotencyKey).toBe('action-key')
  })
})
