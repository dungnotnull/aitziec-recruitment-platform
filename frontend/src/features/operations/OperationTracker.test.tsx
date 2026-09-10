import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { Operation, SuccessResponse } from '@/api/types'
import { OperationTracker } from './OperationTracker'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('OperationTracker', () => {
  it('shows server progress and accessible terminal guidance without inventing progress', async () => {
    const operation: Operation = {
      id: 'operation-1',
      type: 'CV_JOB_ANALYSIS',
      status: 'FAILED',
      progressPercent: null,
      resultResource: null,
      failure: { code: 'UPSTREAM_UNAVAILABLE', message: 'Analysis provider is unavailable.' },
      createdAt: '2026-09-09T01:00:00.000Z',
      updatedAt: '2026-09-09T01:01:00.000Z',
      completedAt: '2026-09-09T01:01:00.000Z',
    }
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: operation }, status: 200, statusText: 'OK', headers: {}, config,
    }) as AxiosResponse<SuccessResponse<Operation>>) satisfies AxiosAdapter
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(<QueryClientProvider client={queryClient}><OperationTracker operationId="operation-1" /></QueryClientProvider>)

    expect(await screen.findByRole('heading', { name: 'Operation failed' })).toBeVisible()
    expect(screen.getByText('Analysis provider is unavailable.')).toBeVisible()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText(/safe to retry the original action/i)).toBeVisible()
  })
})
