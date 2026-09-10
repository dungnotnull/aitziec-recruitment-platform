import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { Company, Job, SuccessResponse, UserSummary } from '@/api/types'
import { adminApi } from './api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('adminApi moderation contracts', () => {
  it('requires the exact user status and reason payload', async () => {
    let requestData = ''
    apiClient.defaults.adapter = (async (config) => {
      requestData = String(config.data)
      const user: UserSummary = { id: 'user-1', email: 'user@example.com', role: 'CANDIDATE', status: 'SUSPENDED', createdAt: '2026-09-01T00:00:00.000Z' }
      return { data: { data: user }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<SuccessResponse<UserSummary>>
    }) satisfies AxiosAdapter
    await adminApi.updateUserStatus('user-1', { status: 'SUSPENDED', reason: 'Policy breach' })
    expect(JSON.parse(requestData)).toEqual({ status: 'SUSPENDED', reason: 'Policy breach' })
  })

  it('propagates reason and expected version for company and job moderation', async () => {
    const payloads: unknown[] = []
    apiClient.defaults.adapter = (async (config) => {
      payloads.push(JSON.parse(String(config.data)))
      return { data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse<SuccessResponse<Company | Job>>
    }) satisfies AxiosAdapter
    await adminApi.updateCompanyStatus('company-1', { status: 'SUSPENDED', reason: 'Policy breach', expectedVersion: 4 })
    await adminApi.moderateJob('job-1', { action: 'UNPUBLISH', reason: 'Misleading listing', expectedVersion: 7 })
    expect(payloads).toEqual([
      { status: 'SUSPENDED', reason: 'Policy breach', expectedVersion: 4 },
      { action: 'UNPUBLISH', reason: 'Misleading listing', expectedVersion: 7 },
    ])
  })
})
