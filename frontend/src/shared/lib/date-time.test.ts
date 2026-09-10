import { describe, expect, it } from 'vitest'
import { formatUtcDate, formatUtcDateTime } from './date-time'

describe('UTC presentation formatting', () => {
  it('formats the same instant deterministically in the selected locale and timezone', () => {
    expect(formatUtcDateTime('2026-09-08T09:30:00.000Z', 'en-US', 'UTC')).toContain('Sep 8, 2026')
    expect(formatUtcDate('2026-09-08T23:30:00.000Z', 'en-US', 'UTC')).toBe('Sep 8, 2026')
  })

  it('returns a safe label for an invalid timestamp', () => {
    expect(formatUtcDateTime('not-a-date', 'en-US', 'UTC')).toBe('Unknown time')
  })
})
