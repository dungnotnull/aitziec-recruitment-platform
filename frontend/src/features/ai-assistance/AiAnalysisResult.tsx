import { AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react'
import type { AiAnalysis } from '@/api/types'
import { formatUtcDateTime } from '@/shared/lib/date-time'

function EvidenceList({ title, items, tone = 'neutral' }: { title: string; items: string[]; tone?: 'positive' | 'warning' | 'neutral' }) {
  const icon = tone === 'positive'
    ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
    : tone === 'warning'
      ? <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
      : <CircleDashed className="h-4 w-4 text-slate" aria-hidden="true" />
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">{icon}{title}</h3>
      {items.length ? <ul className="mt-3 space-y-2 text-ink-muted">{items.map((item) => <li key={item} className="border-l-2 border-border pl-3">{item}</li>)}</ul>
        : <p className="mt-3 text-sm text-ink-muted">No evidence was returned for this section.</p>}
    </section>
  )
}

export function AiAnalysisResult({ analysis }: { analysis: AiAnalysis }) {
  const score = analysis.overallScore === null ? null : Math.max(0, Math.min(100, analysis.overallScore))
  return (
    <section className="space-y-5" aria-labelledby="analysis-result-title">
      <div className="rounded-xl border border-action/30 bg-surface p-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-action">Advisory analysis</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div><h2 id="analysis-result-title" className="font-display text-2xl font-bold text-ink">CV and job evidence</h2><p className="mt-1 text-ink-muted">This analysis supports your review. It does not make a hiring decision.</p></div>
          <p className="font-mono text-2xl font-bold text-ink">{score === null ? 'Not scored' : `${score} / 100`}</p>
        </div>
      </div>

      <div className="space-y-3" aria-label="Score components">
        {analysis.components.map((component) => {
          const componentScore = Math.max(0, Math.min(100, component.score))
          return (
            <details key={component.name} className="group rounded-lg border border-border bg-surface p-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action">
                <span>{component.name.toLowerCase().replace('_', ' ')}</span>
                <span className="font-mono">{componentScore}/100 · weight {component.weight}%</span>
              </summary>
              <ul className="mt-3 space-y-2 border-l-2 border-action/30 pl-4 text-ink-muted">{component.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
            </details>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EvidenceList title="Matched skills" items={analysis.matchedSkills} tone="positive" />
        <EvidenceList title="Missing skills" items={analysis.missingSkills} tone="warning" />
        <EvidenceList title="Unmet requirements" items={analysis.unmetRequirements} tone="warning" />
        <EvidenceList title="Practical next steps" items={analysis.suggestions} />
      </div>
      <EvidenceList title="Limitations" items={analysis.limitations} />
      <footer className="rounded-lg bg-surface-raised p-4 font-mono text-xs text-ink-muted">
        Model {analysis.model} · Prompt {analysis.promptVersion} · Schema {analysis.schemaVersion} · {formatUtcDateTime(analysis.createdAt)}
      </footer>
    </section>
  )
}
