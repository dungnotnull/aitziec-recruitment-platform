import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { Job, PaginatedResponse, RecommendedJob, SuccessResponse, SavedJobCheck } from '@/api/types'
import { Recommendations } from './Recommendations'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('Recommendations', () => {
  it('renders server-ranked jobs without fabricating local reasons', async () => {
    const job: Job = {
      id: 'job-1', slug: 'platform-engineer', title: 'Platform Engineer', description: 'Build reliable systems.',
      requirements: 'TypeScript', responsibilities: null, technologyNames: ['TypeScript'], location: 'Da Nang',
      workplaceType: 'REMOTE', experienceLevel: 'SENIOR', employmentType: 'FULL_TIME', salaryMin: null,
      salaryMax: null, currency: 'VND', applicationDeadline: '2026-12-01T00:00:00.000Z', status: 'PUBLISHED',
      publishedAt: '2026-09-09T00:00:00.000Z', closedAt: null, version: 1,
      createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z',
      company: { id: 'company-1', slug: 'acme', name: 'Acme', logoUrl: null },
    }
    const recommendedItem: RecommendedJob = {
      job,
      score: 95,
      reasonCodes: ['SKILL_MATCH'],
      evidence: ['TypeScript experience'],
      limitations: [],
    }
    apiClient.defaults.adapter = (async (config) => {
      if (config.url?.includes('/saved-jobs')) {
        return {
          data: { data: { isSaved: false } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<SavedJobCheck>>
      }
      return {
        data: { data: [recommendedItem], meta: { page: { nextCursor: null, hasNextPage: false, limit: 20 } } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse<PaginatedResponse<RecommendedJob>>
    }) satisfies AxiosAdapter

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><Recommendations /></QueryClientProvider>)

    expect(await screen.findByRole('heading', { name: 'Platform Engineer' })).toBeVisible()
    expect(screen.getByText('Recommended by the server')).toBeVisible()
    expect(screen.queryByText(/because you/i)).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Save job' })).toBeVisible()
  })
})

