import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import type { JobSearchFilters, SuccessResponse } from '@/api/types'
import { NaturalLanguageSearch } from './NaturalLanguageSearch'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('NaturalLanguageSearch', () => {
  it('previews parsed filters and applies only the user-confirmed values', async () => {
    const parsed: JobSearchFilters = { q: 'platform engineer', location: ['Da Nang'], workplaceType: ['REMOTE'] }
    apiClient.defaults.adapter = (async (config) => ({
      data: { data: parsed }, status: 200, statusText: 'OK', headers: {}, config,
    }) as AxiosResponse<SuccessResponse<JobSearchFilters>>) satisfies AxiosAdapter
    const onApply = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><NaturalLanguageSearch onApply={onApply} /></QueryClientProvider>)

    await userEvent.type(screen.getByLabelText('Describe the job you want'), 'Remote platform role in Da Nang')
    await userEvent.click(screen.getByRole('button', { name: 'Preview filters' }))
    expect(await screen.findByText('Da Nang')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Remove location Da Nang' }))
    await userEvent.click(screen.getByRole('button', { name: 'Apply parsed filters' }))

    expect(onApply).toHaveBeenCalledWith({ q: 'platform engineer', workplaceType: ['REMOTE'] })
  })

  it('preserves the original query after a provider failure', async () => {
    apiClient.defaults.adapter = (async () => { throw new Error('offline') }) satisfies AxiosAdapter
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><NaturalLanguageSearch onApply={() => undefined} /></QueryClientProvider>)
    const input = screen.getByLabelText('Describe the job you want')
    await userEvent.type(input, 'Senior TypeScript role')
    await userEvent.click(screen.getByRole('button', { name: 'Preview filters' }))
    expect(await screen.findByText('The request could not be completed.')).toBeVisible()
    expect(input).toHaveValue('Senior TypeScript role')
  })
})
