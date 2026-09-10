import { describe, expect, it } from 'vitest'
import { getNavigationItems } from './navigation-items'

describe('getNavigationItems', () => {
  it('keeps role workspaces scoped while exposing notifications to every authenticated role', () => {
    expect(getNavigationItems('CANDIDATE').map((item) => item.href)).toEqual([
      '/notifications', '/profile', '/candidate/recommendations', '/candidate/ai',
    ])
    expect(getNavigationItems('HR').map((item) => item.href)).toEqual(['/notifications', '/company'])
    expect(getNavigationItems('ADMIN').map((item) => item.href)).toEqual(['/notifications', '/admin', '/admin/audit'])
  })
})
