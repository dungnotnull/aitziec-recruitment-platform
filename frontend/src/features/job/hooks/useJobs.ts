import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobApi } from '../api/job.api';
import type { JobSearchFilters, CreateJobRequest, UpdateJobRequest } from '@/api/types';

export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters: JobSearchFilters) => [...jobKeys.lists(), filters] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (idOrSlug: string) => [...jobKeys.details(), idOrSlug] as const,
};

export const useJobs = (filters?: JobSearchFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: jobKeys.list(filters || {}),
    queryFn: () => jobApi.getJobs(filters),
    enabled: options?.enabled,
  });
};

export const useCompanyJobs = (companyId: string | undefined, filters?: JobSearchFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: jobKeys.list({ ...filters, companyId }),
    queryFn: () => jobApi.getCompanyJobs(companyId!, filters),
    enabled: !!companyId && (options?.enabled !== false),
  });
};

export const useJobDetail = (idOrSlug: string, enabled = true) => {
  return useQuery({
    queryKey: jobKeys.detail(idOrSlug),
    queryFn: () => jobApi.getJob(idOrSlug),
    enabled: !!idOrSlug && enabled,
  });
};

export const useCreateJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      data,
      idempotencyKey,
    }: {
      companyId: string;
      data: CreateJobRequest;
      idempotencyKey?: string;
    }) => jobApi.createJob(companyId, data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
};

export const useUpdateJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: UpdateJobRequest }) =>
      jobApi.updateJob(jobId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(data.data.id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
};

export const usePublishJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, expectedVersion }: { jobId: string; expectedVersion: number }) =>
      jobApi.publishJob(jobId, expectedVersion),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(data.data.id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
};

export const useUnpublishJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, expectedVersion }: { jobId: string; expectedVersion: number }) =>
      jobApi.unpublishJob(jobId, expectedVersion),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(data.data.id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
};

export const useCloseJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      expectedVersion,
      reason,
    }: {
      jobId: string;
      expectedVersion: number;
      reason?: string;
    }) => jobApi.closeJob(jobId, expectedVersion, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(data.data.id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
};

export const useParseSearchQuery = () => {
  return useMutation({
    mutationFn: (query: string) => jobApi.parseSearchQuery(query),
  });
};
