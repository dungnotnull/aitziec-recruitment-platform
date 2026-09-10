import type { ApiErrorDetails } from '@/shared/lib/api-error'

export function aiFailureMessage(error: Pick<ApiErrorDetails, 'code' | 'message'>): string {
  switch (error.code) {
    case 'RATE_LIMITED':
      return 'The analysis rate limit was reached. Your existing data is unchanged; try again later.'
    case 'UPSTREAM_UNAVAILABLE':
      return 'The analysis provider is temporarily unavailable. Your existing data is unchanged and it is safe to retry.'
    case 'AI_OUTPUT_INVALID':
      return 'The application could not validate the provider response, so no analysis result is shown. It is safe to retry.'
    default:
      return error.message
  }
}
