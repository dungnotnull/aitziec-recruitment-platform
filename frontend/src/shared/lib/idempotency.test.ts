import { describe, expect, it } from 'vitest'
import { createActionKey } from './idempotency'

describe('createActionKey', () => {
  it('creates a UUID suitable for one mutation retry window', () => {
    expect(createActionKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})
