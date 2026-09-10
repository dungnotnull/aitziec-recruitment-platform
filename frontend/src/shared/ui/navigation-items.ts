import type { UserRole } from '@/api/types'

export type NavigationItem = {
  href: string
  label: string
  icon: 'bell' | 'user' | 'sparkles' | 'brain' | 'building' | 'shield' | 'audit' | 'search'
}

export function getNavigationItems(role: UserRole): NavigationItem[] {
  const common: NavigationItem[] = [
    { href: '/jobs', label: 'Find jobs', icon: 'search' },
    { href: '/notifications', label: 'Notifications', icon: 'bell' }
  ]
  if (role === 'CANDIDATE') return [
    ...common,
    { href: '/profile', label: 'My profile', icon: 'user' },
    { href: '/candidate/recommendations', label: 'Recommendations', icon: 'sparkles' },
    { href: '/candidate/ai', label: 'CV analysis', icon: 'brain' },
  ]
  if (role === 'HR') return [...common, { href: '/company', label: 'Company dashboard', icon: 'building' }]
  return [
    ...common,
    { href: '/admin', label: 'Admin', icon: 'shield' },
    { href: '/admin/audit', label: 'Audit log', icon: 'audit' },
  ]
}
