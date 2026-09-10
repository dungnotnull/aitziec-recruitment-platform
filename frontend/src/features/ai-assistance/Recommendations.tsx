import { BriefcaseBusiness, LoaderCircle } from 'lucide-react'
import { SavedJobButton } from '@/features/saved-jobs/components/SavedJobButton'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { useRecommendations } from './hooks'

export function Recommendations() {
  const query = useRecommendations(20)
  const jobs = [...new Map((query.data?.pages.flatMap((page) => page.data) ?? []).map((job) => [job.id, job])).values()]

  return (
    <section className="mx-auto max-w-5xl space-y-6" aria-labelledby="recommendations-title">
      <header className="border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-action">Server-ranked discovery</p>
        <h1 id="recommendations-title" className="mt-1 font-display text-3xl font-bold text-ink">Recommended jobs</h1>
        <p className="mt-2 text-ink-muted">Recommendations come from the API. This page does not score or infer matches in your browser.</p>
      </header>
      {query.isPending ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-ink-muted"><LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />Loading recommendations…</div> : null}
      {query.error ? (() => {
        const error = getApiErrorDetails(query.error)
        return <Alert variant="destructive"><AlertTitle>Recommendations unavailable</AlertTitle><AlertDescription>{error.message}<Button className="mt-3 bg-danger" onClick={() => void query.refetch()}>Try again</Button></AlertDescription></Alert>
      })() : null}
      {!query.isPending && !query.error && jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center"><BriefcaseBusiness className="mx-auto h-8 w-8 text-slate" aria-hidden="true" /><h2 className="mt-4 font-display text-xl font-semibold text-ink">No recommendations yet</h2><p className="mt-2 text-ink-muted">Complete your profile and add a ready CV, then check again.</p></div>
      ) : null}
      <div className="grid gap-4">
        {jobs.map((job) => (
          <article key={job.id} className="grid gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-action">Recommended by the server</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-ink"><a className="hover:underline" href={`/jobs/${encodeURIComponent(job.slug)}`}>{job.title}</a></h2>
              <p className="mt-1 text-ink-muted">{job.company.name} · {job.location} · {job.workplaceType.toLowerCase()}</p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Technologies">{job.technologyNames.map((technology) => <li key={technology} className="rounded-full bg-surface-raised px-3 py-1 text-sm text-ink">{technology}</li>)}</ul>
            </div>
            <SavedJobButton jobId={job.id} />
          </article>
        ))}
      </div>
      {query.hasNextPage ? <div className="flex justify-center"><Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading…' : 'Load more recommendations'}</Button></div> : null}
    </section>
  )
}
