import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { savedJobsApi } from '../api/saved-jobs.api';

export const savedJobKeys = {
  all: ['saved-jobs'] as const,
  lists: () => [...savedJobKeys.all, 'list'] as const,
  list: (cursor?: string) => [...savedJobKeys.lists(), { cursor }] as const,
};

export const useSavedJobs = (cursor?: string) => {
  return useQuery({
    queryKey: savedJobKeys.list(cursor),
    queryFn: () => savedJobsApi.getSavedJobs(cursor),
  });
};

export const useSaveJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => savedJobsApi.saveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedJobKeys.lists() });
    },
  });
};

export const useUnsaveJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => savedJobsApi.unsaveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedJobKeys.lists() });
    },
  });
};

export const useIsJobSaved = (jobId: string) => {
  return useQuery({
    queryKey: [...savedJobKeys.all, 'check', jobId],
    queryFn: () => savedJobsApi.checkSaved(jobId),
    retry: false, // Don't retry if it fails (e.g. 401/403 when not logged in)
  });
};
