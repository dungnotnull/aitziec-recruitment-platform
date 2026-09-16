import type { AxiosAdapter, AxiosResponse } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type { CandidateProfile, PaginatedResponse, SkillCatalogItem, SuccessResponse } from '@/api/types';
import { SkillCombobox } from './SkillCombobox';

const originalAdapter = apiClient.defaults.adapter;

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

const mockProfile: CandidateProfile = {
  id: 'candidate-1',
  userId: 'user-1',
  fullName: 'Candidate',
  headline: null,
  phone: null,
  location: null,
  bio: null,
  isSearchable: true,
  profileCompleteness: 50,
  skills: [{ skillId: 'skill-ts-id', name: 'TypeScript', yearsOfExperience: 3 }],
  experiences: [],
  defaultCvId: null,
  version: 2,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

const catalogSkills: SkillCatalogItem[] = [
  {
    id: 'skill-react-id',
    name: 'React',
    aliases: ['ReactJS'],
    active: true,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  },
  {
    id: 'skill-node-id',
    name: 'Node.js',
    aliases: ['NodeJS'],
    active: true,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  },
];

describe('SkillCombobox', () => {
  it('renders existing skills returned by the profile', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SkillCombobox profile={mockProfile} />
      </QueryClientProvider>
    );

    expect(screen.getByText('TypeScript')).toBeVisible();
  });

  it('searches the skill catalog and allows candidate to add a skill with canonical ID', async () => {
    let patchPayload: any = null;

    apiClient.defaults.adapter = (async (config) => {
      if (config.url?.includes('/skills')) {
        return {
          data: {
            data: catalogSkills,
            meta: { page: { nextCursor: null, hasNextPage: false, limit: 50 } },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<PaginatedResponse<SkillCatalogItem>>;
      }

      if (config.method?.toLowerCase() === 'patch' && config.url?.includes('/candidates/me')) {
        patchPayload = JSON.parse(config.data as string);
        return {
          data: { data: { ...mockProfile, version: 3 } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<CandidateProfile>>;
      }

      throw new Error(`Unhandled: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCombobox profile={mockProfile} />
      </QueryClientProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm kỹ năng/i);
    await userEvent.type(searchInput, 'React');

    expect(await screen.findByText('React')).toBeInTheDocument();
    expect(screen.getByText('(ReactJS)')).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /React/i });
    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(patchPayload).not.toBeNull();
      expect(patchPayload.skills).toEqual(
        expect.arrayContaining([
          { skillId: 'skill-ts-id', yearsOfExperience: 3 },
          { skillId: 'skill-react-id', yearsOfExperience: null },
        ])
      );
    });
  });

  it('allows candidate to remove an existing skill', async () => {
    let patchPayload: any = null;

    apiClient.defaults.adapter = (async (config) => {
      if (config.method?.toLowerCase() === 'patch' && config.url?.includes('/candidates/me')) {
        patchPayload = JSON.parse(config.data as string);
        return {
          data: { data: { ...mockProfile, version: 3, skills: [] } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse<SuccessResponse<CandidateProfile>>;
      }

      throw new Error(`Unhandled: ${config.method} ${config.url}`);
    }) satisfies AxiosAdapter;

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SkillCombobox profile={mockProfile} />
      </QueryClientProvider>
    );

    const removeBtn = screen.getByRole('button', { name: 'Remove TypeScript' });
    await userEvent.click(removeBtn);

    await waitFor(() => {
      expect(patchPayload).not.toBeNull();
      expect(patchPayload.skills).toEqual([]);
    });
  });
});
