import { describe, expect, it } from 'vitest'
import { compareBackendContract } from '../../../scripts/verify-backend-contract.mjs'

describe('backend contract verification', () => {
  it('reports required method and path pairs that are absent from Swagger', () => {
    const openApi = {
      paths: {
        '/api/v1/jobs': { get: {} },
      },
    }
    const requirements = [
      { method: 'GET', path: '/api/v1/jobs', consumer: 'jobs.list' },
      { method: 'GET', path: '/api/v1/notifications', consumer: 'notifications.list' },
    ]

    expect(compareBackendContract(openApi, requirements)).toEqual({
      missing: ['GET /api/v1/notifications'],
      present: ['GET /api/v1/jobs'],
    })
  })

  it('normalizes equivalent Swagger parameter names without accepting extra paths', () => {
    const openApi = {
      paths: {
        '/api/v1/jobs/{jobIdOrSlug}': { get: {} },
      },
    }
    const requirements = [
      { method: 'GET', path: '/api/v1/jobs/{jobId}', consumer: 'jobs.detail' },
      { method: 'PATCH', path: '/api/v1/jobs/{jobId}', consumer: 'jobs.update' },
    ]

    expect(compareBackendContract(openApi, requirements)).toEqual({
      missing: ['PATCH /api/v1/jobs/{jobId}'],
      present: ['GET /api/v1/jobs/{jobId}'],
    })
  })
})
