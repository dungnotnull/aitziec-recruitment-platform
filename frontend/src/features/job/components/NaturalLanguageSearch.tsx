import * as React from 'react'
import { Sparkles, X } from 'lucide-react'
import type { JobSearchFilters } from '@/api/types'
import { Button } from '@/shared/ui/button'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { useParseSearchQuery } from '../hooks/useJobs'

type FilterEntry = { key: keyof JobSearchFilters; value: string; label: string }

const filterLabels: Partial<Record<keyof JobSearchFilters, string>> = {
  q: 'Keywords', technology: 'Technology', location: 'Location', experienceLevel: 'Experience',
  employmentType: 'Employment', workplaceType: 'Workplace', companyId: 'Company',
  salaryMin: 'Minimum salary', salaryMax: 'Maximum salary', currency: 'Currency',
  publishedAfter: 'Published after', sort: 'Sort',
}

function entries(filters: JobSearchFilters): FilterEntry[] {
  return Object.entries(filters).flatMap(([rawKey, rawValue]) => {
    if (rawValue === undefined || rawKey === 'cursor' || rawKey === 'limit') return []
    const key = rawKey as keyof JobSearchFilters
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    return values.map((value) => ({ key, value: String(value), label: filterLabels[key] ?? rawKey }))
  })
}

function removeEntry(filters: JobSearchFilters, entry: FilterEntry): JobSearchFilters {
  const current = filters[entry.key]
  if (Array.isArray(current)) {
    const next = current.filter((value) => value !== entry.value)
    return { ...filters, [entry.key]: next.length ? next : undefined }
  }
  return { ...filters, [entry.key]: undefined }
}

export function NaturalLanguageSearch({ onApply }: { onApply: (filters: JobSearchFilters) => void }) {
  const [query, setQuery] = React.useState('')
  const [preview, setPreview] = React.useState<JobSearchFilters | null>(null)
  const parse = useParseSearchQuery()
  const error = parse.error ? getApiErrorDetails(parse.error) : null

  function previewFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    parse.mutate(trimmed, { onSuccess: (response) => setPreview(response.data) })
  }

  return (
    <section className="rounded-xl border border-action/25 bg-surface p-5" aria-labelledby="natural-search-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-action/10 text-action"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
        <div><h2 id="natural-search-title" className="font-display text-xl font-semibold text-ink">Describe your next role</h2><p className="mt-1 text-sm text-ink-muted">Review every filter before it changes your search.</p></div>
      </div>
      <form className="mt-4 grid gap-3" onSubmit={previewFilters}>
        <label htmlFor="natural-job-query" className="text-sm font-semibold text-ink">Describe the job you want</label>
        <textarea id="natural-job-query" rows={3} className="rounded-md border border-border bg-canvas px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Example: Remote senior TypeScript role in Da Nang" />
        <Button type="submit" className="w-fit" disabled={!query.trim() || parse.isPending}>{parse.isPending ? 'Parsing…' : 'Preview filters'}</Button>
      </form>
      {error ? <div className="mt-4 rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm text-ink" role="alert"><p>{error.message}</p>{error.requestId ? <p className="mt-1 font-mono text-xs">Request {error.requestId}</p> : null}</div> : null}
      {preview ? (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="font-semibold text-ink">Parsed filter preview</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {entries(preview).map((entry) => (
              <span key={`${String(entry.key)}-${entry.value}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface-raised pl-3 pr-1 text-sm text-ink">
                <span><span className="text-ink-muted">{entry.label}:</span> {entry.value}</span>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action" aria-label={`Remove ${entry.label.toLowerCase()} ${entry.value}`} onClick={() => setPreview((current) => current ? removeEntry(current, entry) : current)}><X className="h-4 w-4" aria-hidden="true" /></button>
              </span>
            ))}
          </div>
          <Button className="mt-4" onClick={() => onApply(preview)}>Apply parsed filters</Button>
        </div>
      ) : null}
    </section>
  )
}
