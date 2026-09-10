import { describe, expect, it } from 'vitest'
import { aiFailureMessage } from './ai-error'

describe('aiFailureMessage', () => {
  it('classifies backend provider and validation failures with safe recovery guidance', () => {
    expect(aiFailureMessage({ code: 'RATE_LIMITED', message: 'Too many requests' })).toMatch(/try again later/i)
    expect(aiFailureMessage({ code: 'UPSTREAM_UNAVAILABLE', message: 'Provider unavailable' })).toMatch(/safe to retry/i)
    expect(aiFailureMessage({ code: 'AI_OUTPUT_INVALID', message: 'Invalid output' })).toMatch(/could not validate/i)
  })
})
