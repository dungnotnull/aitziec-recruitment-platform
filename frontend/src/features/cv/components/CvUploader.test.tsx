import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import type { Cv, Operation, SuccessResponse } from '@/api/types'
import { CvUploader } from './CvUploader'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('CvUploader operation handoff', () => {
  it('hands the real upload operation id to the route', async () => {
    const cv: Cv = {
      id: 'cv-1', candidateId: 'candidate-1', originalFileName: 'resume.pdf', mimeType: 'application/pdf',
      sizeBytes: 5, checksumSha256: 'hash', processingStatus: 'UPLOADED', failureCode: null,
      isDefault: false, version: 1, createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T01:00:00.000Z',
    }
    const operation: Operation = {
      id: 'operation-1', type: 'CV_EXTRACTION', status: 'QUEUED', progressPercent: null,
      resultResource: null, failure: null, createdAt: '2026-09-09T01:00:00.000Z',
      updatedAt: '2026-09-09T01:00:00.000Z', completedAt: null,
    }
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: { cv, operation } }, status: 202, statusText: 'Accepted', headers: {}, config,
    }) as AxiosResponse<SuccessResponse<{ cv: Cv; operation: Operation }>>) satisfies AxiosAdapter
    const onOperationCreated = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><CvUploader onOperationCreated={onOperationCreated} /></QueryClientProvider>)

    await userEvent.upload(screen.getByLabelText('PDF file'), new File(['resume'], 'resume.pdf', { type: 'application/pdf' }))
    await userEvent.click(screen.getByRole('button', { name: 'Upload CV' }))

    expect(onOperationCreated).toHaveBeenCalledWith('operation-1')
  })
})
