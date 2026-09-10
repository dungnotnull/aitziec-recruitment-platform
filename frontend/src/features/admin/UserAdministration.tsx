import * as React from 'react'
import { ShieldAlert, UserRoundCog } from 'lucide-react'
import type { AdminUserFilters, UserStatus, UserSummary } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { formatUtcDate } from '@/shared/lib/date-time'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { useAdminUsers, useUpdateUserStatus } from './hooks'

type ModerationTarget = { user: UserSummary; status: UserStatus }

export function UserAdministration() {
  const [filters, setFilters] = React.useState<Omit<AdminUserFilters, 'cursor'>>({ limit: 20 })
  const [target, setTarget] = React.useState<ModerationTarget | null>(null)
  const [reason, setReason] = React.useState('')
  const usersQuery = useAdminUsers(filters)
  const updateStatus = useUpdateUserStatus()
  const users = usersQuery.data?.pages.flatMap((page) => page.data) ?? []
  const queryError = usersQuery.error ? getApiErrorDetails(usersQuery.error) : null
  const mutationError = updateStatus.error ? getApiErrorDetails(updateStatus.error) : null

  function openModeration(user: UserSummary, status: UserStatus) {
    setReason('')
    updateStatus.reset()
    setTarget({ user, status })
  }

  function confirmModeration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!target || !reason.trim()) return
    updateStatus.mutate({ userId: target.user.id, input: { status: target.status, reason: reason.trim() } }, {
      onSuccess: () => setTarget(null),
    })
  }

  return (
    <section className="space-y-6" aria-labelledby="user-admin-title">
      <header className="border-b border-border pb-5"><p className="font-mono text-xs font-semibold uppercase tracking-widest text-action">Accountability workspace</p><h1 id="user-admin-title" className="mt-1 font-display text-3xl font-bold text-ink">User administration</h1><p className="mt-2 text-ink-muted">Review account scope before changing access.</p></header>
      <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface p-4">
        <label className="grid gap-1 text-sm font-semibold text-ink">Role<select className="min-h-11 rounded-md border border-border bg-canvas px-3" value={filters.role ?? ''} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value ? event.target.value as AdminUserFilters['role'] : undefined }))}><option value="">All roles</option><option value="CANDIDATE">Candidate</option><option value="HR">HR</option><option value="ADMIN">Admin</option></select></label>
        <label className="grid gap-1 text-sm font-semibold text-ink">Status<select className="min-h-11 rounded-md border border-border bg-canvas px-3" value={filters.status ?? ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value ? event.target.value as AdminUserFilters['status'] : undefined }))}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DISABLED">Disabled</option></select></label>
      </div>
      {usersQuery.isPending ? <p role="status" className="rounded-lg bg-surface-raised p-6 text-ink-muted">Loading users…</p> : null}
      {queryError ? <Alert variant="destructive"><AlertTitle>Users unavailable</AlertTitle><AlertDescription>{queryError.message}<Button className="mt-3 bg-danger" onClick={() => void usersQuery.refetch()}>Try again</Button></AlertDescription></Alert> : null}
      {!usersQuery.isPending && !queryError && users.length === 0 ? <div className="rounded-xl border border-dashed border-border p-10 text-center"><UserRoundCog className="mx-auto h-8 w-8 text-slate" aria-hidden="true" /><h2 className="mt-4 font-display text-xl font-semibold text-ink">No users match these filters</h2></div> : null}
      {users.length ? (
        <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
          <Table aria-label="User accounts"><TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell className="font-medium text-ink">{user.email}</TableCell><TableCell>{user.role}</TableCell><TableCell><span className="rounded-full bg-surface-raised px-2 py-1 font-mono text-xs font-semibold">{user.status}</span></TableCell><TableCell>{formatUtcDate(user.createdAt)}</TableCell><TableCell><Button className={user.status === 'ACTIVE' ? 'min-h-11 bg-danger' : 'min-h-11'} onClick={() => openModeration(user, user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}>{user.status === 'ACTIVE' ? `Suspend ${user.email}` : `Reactivate ${user.email}`}</Button></TableCell></TableRow>)}</TableBody></Table>
        </div>
      ) : null}
      {users.length ? <div className="grid gap-3 md:hidden" aria-label="User accounts">{users.map((user) => <article key={user.id} className="rounded-lg border border-border bg-surface p-4"><h2 className="break-words font-semibold text-ink">{user.email}</h2><dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm"><dt className="font-semibold">Role</dt><dd>{user.role}</dd><dt className="font-semibold">Status</dt><dd>{user.status}</dd><dt className="font-semibold">Created</dt><dd>{formatUtcDate(user.createdAt)}</dd></dl><Button className={`mt-4 w-full ${user.status === 'ACTIVE' ? 'bg-danger' : ''}`} onClick={() => openModeration(user, user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}>{user.status === 'ACTIVE' ? `Suspend ${user.email}` : `Reactivate ${user.email}`}</Button></article>)}</div> : null}
      {usersQuery.hasNextPage ? <Button disabled={usersQuery.isFetchingNextPage} onClick={() => void usersQuery.fetchNextPage()}>Load more users</Button> : null}

      {target ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="moderation-title" className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl">
            <div className="flex items-start gap-3"><ShieldAlert className="h-6 w-6 text-danger" aria-hidden="true" /><div><h2 id="moderation-title" className="font-display text-xl font-bold text-ink">{target.status === 'SUSPENDED' ? 'Suspend account' : 'Reactivate account'}</h2><p className="mt-1 text-ink-muted">Target: {target.user.email}</p></div></div>
            <p className="mt-4 rounded-lg bg-danger-bg p-3 text-sm text-ink">{target.status === 'SUSPENDED' ? 'Active sessions may stop working and the user will lose authenticated access.' : 'The user will regain authenticated access according to their role.'} This action and its reason are expected to appear in the audit log.</p>
            <form className="mt-4 grid gap-3" onSubmit={confirmModeration}>
              <label htmlFor="moderation-reason" className="font-semibold text-ink">Moderation reason</label>
              <textarea id="moderation-reason" className="rounded-md border border-border bg-canvas px-3 py-2" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
              {mutationError ? <p role="alert" className="text-danger">{mutationError.message}</p> : null}
              <div className="flex flex-wrap justify-end gap-3"><Button type="button" className="bg-surface-raised text-ink" onClick={() => setTarget(null)}>Cancel</Button><Button type="submit" className={target.status === 'SUSPENDED' ? 'bg-danger' : ''} disabled={!reason.trim() || updateStatus.isPending}>{updateStatus.isPending ? 'Applying…' : target.status === 'SUSPENDED' ? 'Confirm suspension' : 'Confirm reactivation'}</Button></div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  )
}
