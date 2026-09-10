import { describe, expect, it } from 'vitest'
import { normalizeJobSearch } from './job-search-url'

describe('normalizeJobSearch', () => {
  it('keeps documented values and removes invalid URL input', () => {
    expect(normalizeJobSearch({
      q: '  platform engineer  ',
      workplaceType: ['REMOTE', 'INVALID'],
      salaryMin: '1000',
      sort: 'NOT_A_SORT',
      cursor: '../unsafe',
    })).toEqual({ q: 'platform engineer', workplaceType: ['REMOTE'], salaryMin: 1000 })
  })
})
