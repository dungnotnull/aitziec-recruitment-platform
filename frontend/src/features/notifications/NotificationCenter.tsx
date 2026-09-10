import * as React from 'react'
import { Bell, Check, CheckCheck, ChevronRight, LoaderCircle, Mail } from 'lucide-react'
import type { Notification } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { formatUtcDate, formatUtcDateTime } from '@/shared/lib/date-time'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { useMarkNotificationRead, useNotifications } from './hooks'
import { notificationResourceHref } from './resource-link'

type ReadFilter = 'all' | 'unread' | 'read'

function groupByDate(notifications: Notification[]): Array<[string, Notification[]]> {
  const groups = new Map<string, Notification[]>()
  notifications.forEach((notification) => {
    const date = formatUtcDate(notification.createdAt)
    groups.set(date, [...(groups.get(date) ?? []), notification])
  })
  return [...groups.entries()]
}

export function NotificationCenter() {
  const [filter, setFilter] = React.useState<ReadFilter>('all')
  const read = filter === 'all' ? undefined : filter === 'read'
  const query = useNotifications({ read, limit: 20 })
  const markRead = useMarkNotificationRead()
  const notifications = query.data?.pages.flatMap((page) => page.data) ?? []
  const error = query.error ? getApiErrorDetails(query.error) : null

  return (
    <section className="mx-auto max-w-4xl space-y-6" aria-labelledby="notifications-title">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-action">Activity inbox</p>
          <h1 id="notifications-title" className="mt-1 font-display text-3xl font-bold text-ink">Notifications</h1>
          <p className="mt-2 text-ink-muted">Recruitment updates linked to your account.</p>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink" htmlFor="notification-filter">
          Show
          <select
            id="notification-filter"
            className="min-h-11 rounded-md border border-border bg-surface px-3 text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action"
            value={filter}
            onChange={(event) => setFilter(event.target.value as ReadFilter)}
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </label>
      </header>

      {query.isPending ? (
        <div role="status" className="grid gap-3" aria-label="Loading notifications">
          {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg bg-surface-raised" />)}
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Notifications could not be loaded</AlertTitle>
          <AlertDescription>
            <p>{error.message}</p>
            {error.requestId ? <p className="mt-1 font-mono text-xs">Request {error.requestId}</p> : null}
            <Button className="mt-4 bg-danger" onClick={() => void query.refetch()}>Try again</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!query.isPending && !error && notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-slate" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-semibold text-ink">No notifications here</h2>
          <p className="mt-2 text-ink-muted">New application and interview updates will appear here.</p>
        </div>
      ) : null}

      {groupByDate(notifications).map(([date, items]) => (
        <section key={date} className="space-y-3" aria-labelledby={`notifications-${date.replaceAll(' ', '-')}`}>
          <h2 id={`notifications-${date.replaceAll(' ', '-')}`} className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted">{date}</h2>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {items.map((notification) => {
              const href = notificationResourceHref(notification.resource)
              const isRead = notification.readAt !== null
              return (
                <article key={notification.id} data-read={String(isRead)} className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                  <span className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full ${isRead ? 'bg-surface-raised text-slate' : 'bg-action/10 text-action'}`}>
                    {isRead ? <Check aria-hidden="true" className="h-5 w-5" /> : <Mail aria-hidden="true" className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ink">{notification.title}</h3>
                    <p className="mt-1 text-ink-muted">{notification.body}</p>
                    <time className="mt-2 block font-mono text-xs text-slate" dateTime={notification.createdAt}>{formatUtcDateTime(notification.createdAt)}</time>
                    {href ? <a className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-action underline-offset-4 hover:underline" href={href}>Open related item <ChevronRight className="h-4 w-4" aria-hidden="true" /></a> : null}
                  </div>
                  {!isRead ? <Button
                    className="min-h-11 bg-surface-raised text-ink hover:bg-border"
                    aria-label={`Mark ${notification.title} as read`}
                    disabled={markRead.isPending && markRead.variables === notification.id}
                    onClick={() => markRead.mutate(notification.id)}
                  >
                    {markRead.isPending && markRead.variables === notification.id
                      ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      : <CheckCheck className="h-4 w-4" aria-hidden="true" />}
                    <span className="ml-2">Mark read</span>
                  </Button> : null}
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {markRead.isSuccess ? `${markRead.data.data.title} marked as read.` : ''}
      </p>
    </section>
  )
}
