import { describe, expect, it } from 'vitest'
import { normalizeAuditSearch } from './audit-search'

describe('normalizeAuditSearch', () => {
  it('keeps valid audit filters and rejects invalid timestamps and cursor values', () => {
    expect(normalizeAuditSearch({ actorId: 'admin-1', action: ' USER_SUSPENDED ', occurredAfter: 'bad-date', cursor: '../bad', limit: '25' }))
      .toEqual({ actorId: 'admin-1', action: 'USER_SUSPENDED', limit: 25 })
  })
})
