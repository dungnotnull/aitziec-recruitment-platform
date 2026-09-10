import { AlertCircle, CheckCircle2, Clock3, LoaderCircle } from 'lucide-react'
import type { Operation } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { useOperation } from './hooks'
import { hasOperationTimedOut } from './polling'

export function OperationStatusView({ operation, timedOut = false }: { operation: Operation; timedOut?: boolean }) {
  if (timedOut) {
    return (
      <Alert variant="destructive">
        <Clock3 className="h-5 w-5" aria-hidden="true" />
        <AlertTitle>Operation is taking longer than expected</AlertTitle>
        <AlertDescription>Automatic polling stopped after five minutes. Retry the status check before starting the original action again.</AlertDescription>
      </Alert>
    )
  }
  if (operation.status === 'FAILED') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
        <AlertTitle>Operation failed</AlertTitle>
        <AlertDescription>
          <p>{operation.failure?.message ?? 'The operation could not be completed.'}</p>
          <p className="mt-2 text-sm">Your existing data is unchanged. It is safe to retry the original action.</p>
        </AlertDescription>
      </Alert>
    )
  }

  if (operation.status === 'SUCCEEDED') {
    return (
      <div className="rounded-lg border border-success/30 bg-success-bg p-4 text-ink" role="status" aria-atomic="true">
        <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />Operation completed</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4" role="status" aria-atomic="true">
      <div className="flex items-center gap-2 font-semibold text-ink">
        {operation.status === 'QUEUED'
          ? <Clock3 className="h-5 w-5 text-warning" aria-hidden="true" />
          : <LoaderCircle className="h-5 w-5 animate-spin text-action" aria-hidden="true" />}
        {operation.status === 'QUEUED' ? 'Operation queued' : 'Operation in progress'}
      </div>
      {operation.progressPercent !== null ? (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm text-ink-muted"><span>Progress</span><span className="font-mono">{operation.progressPercent}%</span></div>
          <div
            className="h-2 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={operation.progressPercent}
          >
            <div className="h-full bg-action transition-transform motion-reduce:transition-none" style={{ transform: `translateX(-${100 - operation.progressPercent}%)` }} />
          </div>
        </div>
      ) : <p className="mt-2 text-sm text-ink-muted">Waiting for progress from the server.</p>}
    </div>
  )
}

export function OperationTracker({ operationId }: { operationId: string }) {
  const query = useOperation(operationId)
  if (query.isPending) return <div className="rounded-lg border border-border bg-surface p-4 text-ink-muted" role="status">Loading operation status…</div>
  if (query.error) {
    const error = getApiErrorDetails(query.error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Operation status unavailable</AlertTitle>
        <AlertDescription>{error.message}{error.requestId ? <span className="mt-1 block font-mono text-xs">Request {error.requestId}</span> : null}</AlertDescription>
      </Alert>
    )
  }
  return query.data ? (
    <OperationStatusView
      operation={query.data.data}
      timedOut={hasOperationTimedOut({
        status: query.data.data.status,
        createdAt: query.data.data.createdAt,
        observedAt: query.dataUpdatedAt,
      })}
    />
  ) : null
}
