import { describe, expect, it } from 'vitest'
import { getOperationPollInterval, hasOperationTimedOut } from './polling'

describe('getOperationPollInterval', () => {
  it('polls only visible non-terminal operations within the time budget', () => {
    expect(getOperationPollInterval({ status: 'QUEUED', hidden: false, elapsedMs: 0 })).toBe(2000)
    expect(getOperationPollInterval({ status: 'PROCESSING', hidden: false, elapsedMs: 299_999 })).toBe(2000)
    expect(getOperationPollInterval({ status: 'SUCCEEDED', hidden: false, elapsedMs: 1 })).toBe(false)
    expect(getOperationPollInterval({ status: 'FAILED', hidden: false, elapsedMs: 1 })).toBe(false)
    expect(getOperationPollInterval({ status: 'PROCESSING', hidden: true, elapsedMs: 1 })).toBe(false)
    expect(getOperationPollInterval({ status: 'PROCESSING', hidden: false, elapsedMs: 300_000 })).toBe(false)
  })

  it('classifies only overdue non-terminal operations as timed out', () => {
    const createdAt = '2026-09-09T01:00:00.000Z'
    const observedAt = Date.parse(createdAt) + 300_000
    expect(hasOperationTimedOut({ status: 'PROCESSING', createdAt, observedAt })).toBe(true)
    expect(hasOperationTimedOut({ status: 'SUCCEEDED', createdAt, observedAt })).toBe(false)
  })
})
