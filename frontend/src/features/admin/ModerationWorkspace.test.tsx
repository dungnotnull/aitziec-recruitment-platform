import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModerationWorkspace } from './ModerationWorkspace'

describe('ModerationWorkspace', () => {
  it('offers real identifier-based company and job lookup', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><ModerationWorkspace /></QueryClientProvider>)
    expect(screen.getByRole('heading', { name: 'Company moderation' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Job moderation' })).toBeVisible()
    expect(screen.getByLabelText('Company ID or slug')).toBeVisible()
    expect(screen.getByLabelText('Job ID or slug')).toBeVisible()
  })
})
