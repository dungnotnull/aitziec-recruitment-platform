import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { notificationApi } from './api'
import { notificationKeys } from './hooks'
import { AuthContext } from '@/features/auth/context'
import { listMyHrInvitations } from '@/features/hr/api'

interface NotificationUnreadBadgeProps {
  className?: string
  variant?: 'floating' | 'inline'
}

export function NotificationUnreadBadge({ className, variant = 'floating' }: NotificationUnreadBadgeProps = {}) {
  const auth = React.useContext(AuthContext)
  const isHr = auth?.session?.user.role === 'HR'

  const query = useQuery({
    queryKey: notificationKeys.unreadSummary(),
    queryFn: ({ signal }) => notificationApi.list({ limit: 1 }, signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const hrInvQuery = useQuery({
    queryKey: ['hr-invitations'],
    queryFn: () => listMyHrInvitations(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: isHr,
  })

  const notifCount = query.data?.meta.unreadCount ?? 0
  const invCount = isHr ? (hrInvQuery.data?.data?.length ?? 0) : 0
  const count = notifCount + invCount
  if (!count) return null

  const label = `${count} unread notification${count === 1 ? '' : 's'}`

  if (variant === 'inline') {
    return (
      <span
        aria-label={label}
        className={`rounded-full bg-[#EA1E30] px-2 py-0.5 text-[11px] font-bold text-white ${className || ''}`}
      >
        {count > 99 ? '99+' : count}
        <span className="sr-only" aria-live="polite">{label}</span>
      </span>
    )
  }

  return (
    <span
      aria-label={label}
      className={`absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#EA1E30] text-white text-[10px] font-extrabold leading-none shadow-sm ring-2 ring-[#121212] pointer-events-none transition-transform ${className || ''}`}
    >
      {count > 99 ? '99+' : count}
      <span className="sr-only" aria-live="polite">{label}</span>
    </span>
  )
}
