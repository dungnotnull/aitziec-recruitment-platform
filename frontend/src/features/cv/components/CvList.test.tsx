import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import type { Cv, SuccessResponse } from '@/api/types'
import { CvList } from './CvList'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('CvList', () => {
  it('renders empty state when there are no CVs', async () => {
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }) as AxiosResponse<SuccessResponse<Cv[]>>) satisfies AxiosAdapter

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <CvList />
      </QueryClientProvider>
    )

    expect(await screen.findByText("You haven't uploaded any CVs yet.")).toBeInTheDocument()
  })

  it('allows candidate to delete the default CV', async () => {
    const defaultCv: Cv = {
      id: 'cv-default',
      candidateId: 'candidate-1',
      originalFileName: 'default_resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024 * 1024,
      checksumSha256: 'hash1',
      processingStatus: 'READY',
      failureCode: null,
      isDefault: true,
      version: 1,
      createdAt: '2026-09-09T01:00:00.000Z',
      updatedAt: '2026-09-09T01:00:00.000Z',
    }

    let deleteRequestedId = ''

    apiClient.defaults.adapter = (async (config) => {
      if (config.method?.toLowerCase() === 'get') {
        return {
          data: { data: [defaultCv] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<Cv[]>>
      }

      if (config.method?.toLowerCase() === 'delete') {
        deleteRequestedId = config.url || ''
        return {
          data: { data: { success: true } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse
      }

      throw new Error(`Unhandled request: ${config.method} ${config.url}`)
    }) satisfies AxiosAdapter

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <CvList />
      </QueryClientProvider>
    )

    expect(await screen.findByText('default_resume.pdf')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()

    const deleteBtn = screen.getByRole('button', { name: 'Delete' })
    expect(deleteBtn).toBeEnabled()

    await userEvent.click(deleteBtn)

    const confirmDeleteBtn = await screen.findByRole('button', { name: 'Delete CV' })
    await userEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(deleteRequestedId).toContain('cv-default')
    })
  })
})
