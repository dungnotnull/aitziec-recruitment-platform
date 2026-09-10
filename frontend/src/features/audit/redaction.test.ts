import { describe, expect, it } from 'vitest'
import { sanitizeAuditMetadata } from './redaction'

describe('sanitizeAuditMetadata', () => {
  it('keeps approved accountability fields and recursively removes sensitive values', () => {
    expect(sanitizeAuditMetadata({
      reason: 'Policy breach',
      previousStatus: 'ACTIVE',
      requestId: 'req-1',
      token: 'secret',
      access_token: 'secret',
      signedUrl: 'https://private.example/file',
      nested: { cvText: 'private', action: 'USER_SUSPENDED', privateNotes: 'private' },
    })).toEqual({ reason: 'Policy breach', previousStatus: 'ACTIVE', requestId: 'req-1' })
  })

  it('drops unknown objects instead of guessing whether they are safe', () => {
    expect(sanitizeAuditMetadata({ providerPayload: { harmlessLooking: 'value' } })).toEqual({})
  })
})
