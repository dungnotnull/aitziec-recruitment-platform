import { useQuery } from '@tanstack/react-query'
import { notificationApi } from './api'
import { notificationKeys } from './hooks'

export function NotificationUnreadBadge() {
  const query = useQuery({
    queryKey: notificationKeys.unreadSummary(),
    queryFn: ({ signal }) => notificationApi.list({ limit: 1 }, signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const count = query.data?.meta.unreadCount ?? 0
  if (!count) return null

  const label = `${count} unread notification${count === 1 ? '' : 's'}`
  return <span aria-label={label} className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{count > 99 ? '99+' : count}<span className="sr-only" aria-live="polite">{label}</span></span>
}
