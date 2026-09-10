import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CandidateProfile } from '@/api/types'
import { SkillCombobox } from './SkillCombobox'

const profile: CandidateProfile = {
  id: 'candidate-1', userId: 'user-1', fullName: 'Candidate', headline: null,
  phone: null, location: null, bio: null, isSearchable: true, profileCompleteness: 50,
  skills: [{ skillId: '1c4a95a8-46a0-49ea-a11e-6d5788ae1792', name: 'TypeScript', yearsOfExperience: 3 }],
  experiences: [], defaultCvId: null, version: 2,
  createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z',
}

describe('SkillCombobox backend mapping', () => {
  it('renders only skills returned by the profile and does not offer fabricated IDs', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <SkillCombobox profile={profile} />
      </QueryClientProvider>,
    )

    expect(screen.getByText('TypeScript')).toBeVisible()
    expect(screen.getByText(/skill catalog is not exposed by the backend/i)).toBeVisible()
    expect(screen.queryByText('Add a skill')).not.toBeInTheDocument()
  })
})
