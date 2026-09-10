import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { useCvs } from '@/features/cv/hooks/useCv'
import { useJobs } from '@/features/job/hooks/useJobs'
import { createActionKey } from '@/shared/lib/idempotency'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { OperationStatusView } from '@/features/operations/OperationTracker'
import { hasOperationTimedOut } from '@/features/operations/polling'
import { useOperation } from '@/features/operations/hooks'
import { useAiAnalysis, useCreateCvJobAnalysis } from './hooks'
import { AiAnalysisResult } from './AiAnalysisResult'
import { aiFailureMessage } from './ai-error'

export function AiAnalysisWorkspace() {
  const [cvId, setCvId] = React.useState('')
  const [jobId, setJobId] = React.useState('')
  const [operationId, setOperationId] = React.useState<string | null>(null)
  const cvsQuery = useCvs()
  const jobsQuery = useJobs({ limit: 50 })
  const createAnalysis = useCreateCvJobAnalysis()
  const operationQuery = useOperation(operationId)
  const operation = operationQuery.data?.data
  const analysisId = operation?.status === 'SUCCEEDED' && operation.resultResource
    ? operation.resultResource.id
    : null
  const analysisQuery = useAiAnalysis(analysisId)
  const readyCvs = (cvsQuery.data?.data ?? []).filter((cv) => cv.processingStatus === 'READY')
  const jobs = jobsQuery.data?.data ?? []
  const error = createAnalysis.error ? getApiErrorDetails(createAnalysis.error) : null

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cvId || !jobId) return
    createAnalysis.mutate({
      input: { cvId, jobId, analyses: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'] },
      idempotencyKey: createActionKey(),
    }, { onSuccess: (response) => setOperationId(response.data.id) })
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6" aria-labelledby="ai-workspace-title">
      <header className="border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-action">Evidence assistant</p>
        <h1 id="ai-workspace-title" className="mt-1 font-display text-3xl font-bold text-ink">Analyze a CV against a job</h1>
        <p className="mt-2 max-w-3xl text-ink-muted">Choose only the CV and job you want evaluated. The result is advisory and cannot change an application status.</p>
      </header>

      <form onSubmit={submit} className="grid gap-5 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-ink">Ready CV
          <select className="min-h-11 rounded-md border border-border bg-canvas px-3" value={cvId} onChange={(event) => setCvId(event.target.value)} required>
            <option value="">Choose a CV</option>
            {readyCvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.originalFileName}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">Job
          <select className="min-h-11 rounded-md border border-border bg-canvas px-3" value={jobId} onChange={(event) => setJobId(event.target.value)} required>
            <option value="">Choose a job</option>
            {jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company.name}</option>)}
          </select>
        </label>
        <div className="md:col-span-2 rounded-lg bg-surface-raised p-4 text-sm text-ink-muted">
          The server receives the identifiers of your selected CV and job. Provider retention and recommendation consent controls remain unavailable until the privacy policy is approved.
        </div>
        {error ? <Alert variant="destructive" className="md:col-span-2"><AlertTitle>Analysis could not start</AlertTitle><AlertDescription>{aiFailureMessage(error)}{error.requestId ? <span className="mt-1 block font-mono text-xs">Request {error.requestId}</span> : null}</AlertDescription></Alert> : null}
        <Button type="submit" className="md:col-span-2 md:w-fit" disabled={!cvId || !jobId || createAnalysis.isPending}>{createAnalysis.isPending ? 'Starting analysis…' : 'Analyze selected CV'}</Button>
      </form>

      {operation ? <OperationStatusView operation={operation} timedOut={hasOperationTimedOut({ status: operation.status, createdAt: operation.createdAt, observedAt: operationQuery.dataUpdatedAt })} /> : null}
      {operationQuery.error ? <Alert variant="destructive"><AlertTitle>Analysis status unavailable</AlertTitle><AlertDescription>{getApiErrorDetails(operationQuery.error).message}</AlertDescription></Alert> : null}
      {analysisQuery.isPending && analysisId ? <p role="status" className="rounded-lg bg-surface-raised p-4 text-ink-muted">Loading analysis evidence…</p> : null}
      {analysisQuery.data ? <AiAnalysisResult analysis={analysisQuery.data.data} /> : null}
      {analysisQuery.error ? <Alert variant="destructive"><AlertTitle>Analysis result unavailable</AlertTitle><AlertDescription>{getApiErrorDetails(analysisQuery.error).message}</AlertDescription></Alert> : null}
    </section>
  )
}
