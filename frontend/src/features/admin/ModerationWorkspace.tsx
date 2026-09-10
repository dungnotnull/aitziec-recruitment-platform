import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import type { Company, Job, ModerateJobRequest } from '@/api/types'
import { getCompany } from '@/features/company/api'
import { jobApi } from '@/features/job/api/job.api'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { adminApi } from './api'

export function ModerationWorkspace() {
  const [companyTarget, setCompanyTarget] = React.useState('')
  const [company, setCompany] = React.useState<Company | null>(null)
  const [companyReason, setCompanyReason] = React.useState('')
  const [jobTarget, setJobTarget] = React.useState('')
  const [job, setJob] = React.useState<Job | null>(null)
  const [jobAction, setJobAction] = React.useState<ModerateJobRequest['action']>('UNPUBLISH')
  const [jobReason, setJobReason] = React.useState('')

  const companyLookup = useMutation({ mutationFn: getCompany, onSuccess: setCompany })
  const jobLookup = useMutation({ mutationFn: async (id: string) => (await jobApi.getJob(id)).data, onSuccess: setJob })
  const companyModeration = useMutation({
    mutationFn: async () => adminApi.updateCompanyStatus(company!.id, {
      expectedVersion: company!.version,
      status: company!.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      reason: companyReason.trim(),
    }),
    onSuccess: (response) => { setCompany(response.data); setCompanyReason('') },
  })
  const jobModeration = useMutation({
    mutationFn: async () => adminApi.moderateJob(job!.id, {
      action: jobAction,
      expectedVersion: job!.version,
      reason: jobReason.trim(),
    }),
    onSuccess: (response) => { setJob(response.data); setJobReason('') },
  })

  const companyError = companyLookup.error ?? companyModeration.error
  const jobError = jobLookup.error ?? jobModeration.error

  return (
    <section className="space-y-6" aria-labelledby="resource-moderation-title">
      <header>
        <h2 id="resource-moderation-title" className="font-display text-2xl font-bold text-ink">Resource moderation</h2>
        <p className="mt-2 text-ink-muted">Look up a known server identifier or slug. The backend does not expose admin company or job collection discovery.</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Company moderation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); setCompany(null); companyLookup.mutate(companyTarget.trim()) }}>
              <label className="grid flex-1 gap-1 font-semibold">Company ID or slug<input className="min-h-11 rounded-md border border-border bg-canvas px-3" value={companyTarget} onChange={(event) => setCompanyTarget(event.target.value)} /></label>
              <Button type="submit" disabled={!companyTarget.trim() || companyLookup.isPending}>{companyLookup.isPending ? 'Looking up…' : 'Look up company'}</Button>
            </form>
            {companyError ? <Alert variant="destructive"><AlertTitle>Company action failed</AlertTitle><AlertDescription>{getApiErrorDetails(companyError).message}</AlertDescription></Alert> : null}
            {company ? <div className="space-y-3 rounded-lg border border-border p-4"><h3 className="font-semibold">{company.name}</h3><p className="font-mono text-sm">{company.status} · version {company.version}</p><p className="text-sm text-ink-muted">This backend action changes the company status only; it does not automatically change existing job statuses. The reason and version are recorded for audit.</p><label className="grid gap-1 font-semibold">Moderation reason<textarea className="rounded-md border border-border bg-canvas px-3 py-2" value={companyReason} onChange={(event) => setCompanyReason(event.target.value)} /></label><Button className={company.status === 'ACTIVE' ? 'bg-danger' : ''} disabled={!companyReason.trim() || companyModeration.isPending} onClick={() => companyModeration.mutate()}>{companyModeration.isPending ? 'Applying…' : company.status === 'ACTIVE' ? 'Suspend company' : 'Reactivate company'}</Button></div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Job moderation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); setJob(null); jobLookup.mutate(jobTarget.trim()) }}>
              <label className="grid flex-1 gap-1 font-semibold">Job ID or slug<input className="min-h-11 rounded-md border border-border bg-canvas px-3" value={jobTarget} onChange={(event) => setJobTarget(event.target.value)} /></label>
              <Button type="submit" disabled={!jobTarget.trim() || jobLookup.isPending}>{jobLookup.isPending ? 'Looking up…' : 'Look up job'}</Button>
            </form>
            {jobError ? <Alert variant="destructive"><AlertTitle>Job action failed</AlertTitle><AlertDescription>{getApiErrorDetails(jobError).message}</AlertDescription></Alert> : null}
            {job ? <div className="space-y-3 rounded-lg border border-border p-4"><h3 className="font-semibold">{job.title}</h3><p className="font-mono text-sm">{job.status} · version {job.version}</p><p className="text-sm text-ink-muted">Unpublish removes the job from public discovery; close is terminal. The backend checks this version and records the reason in audit history.</p><label className="grid gap-1 font-semibold">Action<select className="min-h-11 rounded-md border border-border bg-canvas px-3" value={jobAction} onChange={(event) => setJobAction(event.target.value as ModerateJobRequest['action'])}><option value="UNPUBLISH">Unpublish</option><option value="CLOSE">Close</option></select></label><label className="grid gap-1 font-semibold">Moderation reason<textarea className="rounded-md border border-border bg-canvas px-3 py-2" value={jobReason} onChange={(event) => setJobReason(event.target.value)} /></label><Button className="bg-danger" disabled={!jobReason.trim() || jobModeration.isPending || job.status === 'CLOSED'} onClick={() => jobModeration.mutate()}>{jobModeration.isPending ? 'Applying…' : jobAction === 'CLOSE' ? 'Close job' : 'Unpublish job'}</Button></div> : null}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
