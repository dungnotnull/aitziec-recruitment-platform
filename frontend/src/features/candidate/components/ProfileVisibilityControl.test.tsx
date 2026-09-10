import type { AxiosAdapter, AxiosResponse } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import type { CandidateProfile, SuccessResponse } from '@/api/types'
import { ProfileVisibilityControl } from './ProfileVisibilityControl'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

const profile: CandidateProfile = {
  id: 'candidate-1', userId: 'user-1', fullName: 'Lan Nguyen', headline: null,
  phone: null, location: null, bio: null, isSearchable: true,
  profileCompleteness: 60, skills: [], experiences: [], defaultCvId: null,
  version: 3, createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T01:00:00.000Z',
}

describe('ProfileVisibilityControl', () => {
  it('persists visibility using the profile API and current version', async () => {
    let requestData: unknown
    apiClient.defaults.adapter = (async (config) => {
      requestData = JSON.parse(String(config.data))
      return {
        data: { data: { ...profile, isSearchable: false, version: 4 } },
        status: 200, statusText: 'OK', headers: {}, config,
      } as AxiosResponse<SuccessResponse<CandidateProfile>>
    }) satisfies AxiosAdapter
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <ProfileVisibilityControl profile={profile} />
      </QueryClientProvider>,
    )

    await userEvent.click(screen.getByRole('switch', { name: 'Profile visibility' }))

    await waitFor(() => expect(requestData).toEqual({ expectedVersion: 3, isSearchable: false }))
    expect(screen.getByRole('switch', { name: 'Profile visibility' })).toHaveAttribute('aria-checked', 'false')
  })
})
