import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AiAnalysis } from '@/api/types'
import { AiAnalysisResult } from './AiAnalysisResult'

const analysis: AiAnalysis = {
  id: 'analysis-1', type: 'CV_JOB_MATCH', candidateId: 'candidate-1', cvId: 'cv-1', jobId: 'job-1',
  status: 'SUCCEEDED', overallScore: 82,
  components: [{ name: 'SKILLS', score: 90, weight: 0.4, evidence: ['TypeScript projects'] }],
  matchedSkills: ['TypeScript'], missingSkills: ['Kubernetes'], unmetRequirements: ['Five years leadership'],
  suggestions: ['Add measurable leadership examples.'], limitations: ['Only the selected CV and job were evaluated.'],
  model: 'gemini-model', promptVersion: 'prompt-v1', schemaVersion: 'schema-v1',
  createdAt: '2026-09-09T01:00:00.000Z',
}

describe('AiAnalysisResult', () => {
  it('presents evidence, gaps, provenance, and persistent advisory language', async () => {
    render(<AiAnalysisResult analysis={analysis} />)

    expect(screen.getByText('82 / 100')).toBeVisible()
    expect(screen.getByText(/weight 40%/i)).toBeVisible()
    await userEvent.click(screen.getByText('skills'))
    expect(screen.getByText('TypeScript projects')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Missing skills' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Unmet requirements' })).toBeVisible()
    expect(screen.getByText(/advisory/i)).toBeVisible()
    expect(screen.getByText(/prompt-v1/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /pass|reject/i })).not.toBeInTheDocument()
  })
})
