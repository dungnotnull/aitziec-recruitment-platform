import { describe, expect, it } from 'vitest'
import { toAuditApiFilters } from './api'

describe('toAuditApiFilters', () => {
  it('maps browser-facing dates to backend query names', () => {
    expect(toAuditApiFilters({
      occurredAfter: '2026-09-01T00:00:00.000Z',
      occurredBefore: '2026-09-10T00:00:00.000Z',
    })).toEqual({
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-10T00:00:00.000Z',
    })
  })
})
