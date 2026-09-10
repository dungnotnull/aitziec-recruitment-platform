import { describe, expect, it } from 'vitest'
import { normalizeCompanyTarget } from './company-context'

describe('company route context', () => {
  it('accepts only a non-empty company identifier returned by backend navigation', () => {
    expect(normalizeCompanyTarget(' company-123 ')).toBe('company-123')
    expect(normalizeCompanyTarget('')).toBeUndefined()
    expect(normalizeCompanyTarget(42)).toBeUndefined()
  })
})
