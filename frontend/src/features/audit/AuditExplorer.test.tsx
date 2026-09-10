import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { AuditLog, PaginatedResponse } from '@/api/types'
import { AuditExplorer } from './AuditExplorer'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

describe('AuditExplorer', () => {
  it('shows accountability fields while redacting prohibited metadata', async () => {
    const log: AuditLog = {
      id: 'audit-1', actorId: 'admin-1', action: 'USER_SUSPENDED', targetType: 'USER', targetId: 'user-1',
      requestId: 'req-1', occurredAt: '2026-09-09T01:00:00.000Z',
      metadata: { reason: 'Policy breach', token: 'secret-token', privateNotes: 'hidden' },
    }
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: [log], meta: { page: { nextCursor: null, hasNextPage: false, limit: 25 } } },
      status: 200, statusText: 'OK', headers: {}, config,
    }) as AxiosResponse<PaginatedResponse<AuditLog>>) satisfies AxiosAdapter
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><AuditExplorer filters={{ limit: 25 }} onFiltersChange={() => undefined} /></QueryClientProvider>)

    const [viewButton] = await screen.findAllByRole('button', { name: 'View audit USER_SUSPENDED for user-1' })
    await userEvent.click(viewButton)
    expect(screen.getByRole('dialog', { name: 'Audit record details' })).toBeVisible()
    expect(screen.getByText('Policy breach')).toBeVisible()
    expect(screen.getByText('req-1')).toBeVisible()
    expect(screen.queryByText('secret-token')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })

  it('renders nullable backend accountability fields safely', async () => {
    const log = {
      id: 'audit-system', actorId: null, action: 'SYSTEM_EVENT', targetType: 'JOB', targetId: 'job-1',
      requestId: null, occurredAt: '2026-09-09T01:00:00.000Z', metadata: {},
    } satisfies AuditLog
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: [log], meta: { page: { nextCursor: null, hasNextPage: false, limit: 25 } } },
      status: 200, statusText: 'OK', headers: {}, config,
    }) as AxiosResponse<PaginatedResponse<AuditLog>>) satisfies AxiosAdapter
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><AuditExplorer filters={{ limit: 25 }} onFiltersChange={() => undefined} /></QueryClientProvider>)

    const [viewButton] = await screen.findAllByRole('button', { name: 'View audit SYSTEM_EVENT for job-1' })
    expect(screen.getAllByText('System').length).toBeGreaterThan(0)
    await userEvent.click(viewButton)
    expect(screen.getByText('Not provided')).toBeVisible()
  })
})
