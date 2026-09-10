import * as React from 'react'
import { FileSearch } from 'lucide-react'
import type { AuditLog, AuditLogFilters } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { formatUtcDateTime } from '@/shared/lib/date-time'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { sanitizeAuditMetadata } from './redaction'
import { useAuditLogs } from './hooks'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'

function toUtcFilter(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

function toLocalInput(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function actorLabel(actorId: string | null): string {
  return actorId ?? 'System'
}

export function AuditExplorer({ filters, onFiltersChange }: {
  filters: Omit<AuditLogFilters, 'cursor'>
  onFiltersChange: (filters: Omit<AuditLogFilters, 'cursor'>) => void
}) {
  const query = useAuditLogs(filters)
  const [selected, setSelected] = React.useState<AuditLog | null>(null)
  const logs = query.data?.pages.flatMap((page) => page.data) ?? []
  const error = query.error ? getApiErrorDetails(query.error) : null
  const metadata = selected ? sanitizeAuditMetadata(selected.metadata) : {}

  function setFilter(key: keyof AuditLogFilters, value: string) {
    onFiltersChange({ ...filters, [key]: value.trim() || undefined })
  }

  return (
    <section className="space-y-6" aria-labelledby="audit-title">
      <header className="border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-action">Immutable evidence</p>
        <h1 id="audit-title" className="mt-1 font-display text-3xl font-bold text-ink">Audit log</h1>
        <p className="mt-2 text-ink-muted">Trace who changed a recruitment resource and when.</p>
      </header>
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-ink">Actor ID<input className="min-h-11 rounded-md border border-border bg-canvas px-3" value={filters.actorId ?? ''} onChange={(event) => setFilter('actorId', event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink">Action<input className="min-h-11 rounded-md border border-border bg-canvas px-3" value={filters.action ?? ''} onChange={(event) => setFilter('action', event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink">Target type<input className="min-h-11 rounded-md border border-border bg-canvas px-3" value={filters.targetType ?? ''} onChange={(event) => setFilter('targetType', event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink">Target ID<input className="min-h-11 rounded-md border border-border bg-canvas px-3" value={filters.targetId ?? ''} onChange={(event) => setFilter('targetId', event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink">Occurred after (local)<input type="datetime-local" className="min-h-11 rounded-md border border-border bg-canvas px-3" value={toLocalInput(filters.occurredAfter)} onChange={(event) => onFiltersChange({ ...filters, occurredAfter: toUtcFilter(event.target.value) })} /></label>
        <label className="grid gap-1 text-sm font-semibold text-ink">Occurred before (local)<input type="datetime-local" className="min-h-11 rounded-md border border-border bg-canvas px-3" value={toLocalInput(filters.occurredBefore)} onChange={(event) => onFiltersChange({ ...filters, occurredBefore: toUtcFilter(event.target.value) })} /></label>
      </div>

      {query.isPending ? <p role="status" className="rounded-lg bg-surface-raised p-6 text-ink-muted">Loading audit records…</p> : null}
      {error ? <Alert variant="destructive"><AlertTitle>Audit records unavailable</AlertTitle><AlertDescription>{error.message}<Button className="mt-3 bg-danger" onClick={() => void query.refetch()}>Try again</Button></AlertDescription></Alert> : null}
      {!query.isPending && !error && logs.length === 0 ? <div className="rounded-xl border border-dashed border-border p-10 text-center"><FileSearch className="mx-auto h-8 w-8 text-slate" aria-hidden="true" /><h2 className="mt-4 font-display text-xl font-semibold text-ink">No audit records match</h2></div> : null}

      {logs.length ? <>
        <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
          <Table aria-label="Audit records"><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Actor</TableHead><TableHead>Target</TableHead><TableHead><span className="sr-only">Details</span></TableHead></TableRow></TableHeader>
            <TableBody>{logs.map((log) => <TableRow key={log.id}><TableCell className="font-mono text-xs">{formatUtcDateTime(log.occurredAt)}</TableCell><TableCell>{log.action}</TableCell><TableCell className="font-mono text-xs">{actorLabel(log.actorId)}</TableCell><TableCell>{log.targetType} · <span className="font-mono text-xs">{log.targetId}</span></TableCell><TableCell><Button className="min-h-11 bg-surface-raised text-ink" aria-label={`View audit ${log.action} for ${log.targetId}`} onClick={() => setSelected(log)}>View details</Button></TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="grid gap-3 md:hidden" aria-label="Audit records">
          {logs.map((log) => <article key={log.id} className="rounded-lg border border-border bg-surface p-4"><p className="font-mono text-xs text-ink-muted">{formatUtcDateTime(log.occurredAt)}</p><h2 className="mt-2 font-semibold text-ink">{log.action}</h2><dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm"><dt className="font-semibold">Actor</dt><dd className="min-w-0 break-words font-mono text-xs">{actorLabel(log.actorId)}</dd><dt className="font-semibold">Target</dt><dd className="min-w-0 break-words">{log.targetType} · <span className="font-mono text-xs">{log.targetId}</span></dd></dl><Button className="mt-4 w-full bg-surface-raised text-ink" aria-label={`View audit ${log.action} for ${log.targetId}`} onClick={() => setSelected(log)}>View details</Button></article>)}
        </div>
      </> : null}
      {query.hasNextPage ? <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more records</Button> : null}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        {selected ? <DialogContent className="max-w-xl"><DialogTitle>Audit record details</DialogTitle><dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm"><dt className="font-semibold">Request ID</dt><dd className="min-w-0 break-words font-mono">{selected.requestId ?? 'Not provided'}</dd><dt className="font-semibold">Actor</dt><dd className="min-w-0 break-words font-mono">{actorLabel(selected.actorId)}</dd><dt className="font-semibold">Action</dt><dd>{selected.action}</dd><dt className="font-semibold">Target</dt><dd className="min-w-0 break-words">{selected.targetType} · <span className="font-mono">{selected.targetId}</span></dd><dt className="font-semibold">Occurred</dt><dd>{formatUtcDateTime(selected.occurredAt)}</dd></dl><h3 className="mt-4 font-semibold text-ink">Safe metadata</h3>{Object.keys(metadata).length ? <dl className="grid gap-2 rounded-lg bg-surface-raised p-4">{Object.entries(metadata).map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-3"><dt className="font-mono text-xs text-ink-muted">{key}</dt><dd className="min-w-0 break-words text-sm text-ink">{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>)}</dl> : <p className="text-sm text-ink-muted">No display-safe metadata was returned.</p>}</DialogContent> : null}
      </Dialog>
    </section>
  )
}
