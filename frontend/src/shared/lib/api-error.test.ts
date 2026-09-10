import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import type { ErrorResponse } from '@/api/types'
import { getApiErrorDetails } from './api-error'

describe('getApiErrorDetails', () => {
  it('preserves the contract error code and request id for recovery', () => {
    const error = new AxiosError<ErrorResponse>(
      'Request failed',
      'ERR_BAD_RESPONSE',
      { headers: new AxiosHeaders() },
      undefined,
      {
        data: {
          error: {
            code: 'RATE_LIMITED',
            message: 'Wait before trying again.',
            requestId: 'req-123',
            timestamp: '2026-09-08T09:30:00.000Z',
          },
        },
        status: 429,
        statusText: 'Too Many Requests',
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    )

    expect(getApiErrorDetails(error)).toEqual({
      code: 'RATE_LIMITED',
      message: 'Wait before trying again.',
      requestId: 'req-123',
      status: 429,
    })
  })

  it('does not expose arbitrary thrown values', () => {
    expect(getApiErrorDetails({ accessToken: 'secret' })).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'The request could not be completed.',
    })
  })
})
