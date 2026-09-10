import axios from 'axios'
import type { ErrorCode, ErrorResponse } from '@/api/types'

export type ApiErrorDetails = { code: ErrorCode; message: string; requestId?: string; status?: number }

const fallback: ApiErrorDetails = {
  code: 'INTERNAL_ERROR',
  message: 'The request could not be completed.',
}

export function getApiErrorDetails(error: unknown): ApiErrorDetails {
  if (!axios.isAxiosError<ErrorResponse>(error)) return fallback
  const contractError = error.response?.data?.error
  if (!contractError) return { ...fallback, status: error.response?.status }
  return {
    code: contractError.code,
    message: contractError.message,
    requestId: contractError.requestId,
    status: error.response?.status,
  }
}
