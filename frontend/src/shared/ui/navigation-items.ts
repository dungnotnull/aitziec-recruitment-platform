import type { UserRole } from '@/api/types'

export type NavigationItem = {
  href: string
  label: string
  icon: 'bell' | 'user' | 'sparkles' | 'brain' | 'building' | 'shield' | 'audit' | 'search'
}

export function getNavigationItems(role: UserRole): NavigationItem[] {
  const common: NavigationItem[] = [
    { href: '/jobs', label: 'Việc làm IT', icon: 'search' },
    { href: '/notifications', label: 'Thông báo', icon: 'bell' }
  ]
  if (role === 'CANDIDATE') return [
    ...common,
    { href: '/profile', label: 'Hồ sơ cá nhân', icon: 'user' },
    { href: '/candidate/recommendations', label: 'Gợi ý việc làm', icon: 'sparkles' },
    { href: '/candidate/ai', label: 'Phân tích CV', icon: 'brain' },
  ]
  if (role === 'HR') return [
    ...common, 
    { href: '/company', label: 'Quản lý công ty', icon: 'building' },
    { href: '/profile', label: 'Cài đặt tài khoản', icon: 'user' }
  ]
  return [
    ...common,
    { href: '/admin', label: 'Quản trị hệ thống', icon: 'shield' },
    { href: '/admin/audit', label: 'Nhật ký hệ thống', icon: 'audit' },
  ]
}
