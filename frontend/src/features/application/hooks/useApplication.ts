import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationApi } from '../api/application.api';
import type { SubmitApplicationRequest, TransitionApplicationRequest } from '@/api/types';

export const appKeys = {
  all: ['applications'] as const,
  candidateLists: () => [...appKeys.all, 'candidate-list'] as const,
  candidateList: (status?: string, cursor?: string) => [...appKeys.candidateLists(), { status, cursor }] as const,
  jobLists: () => [...appKeys.all, 'job-list'] as const,
  jobList: (jobId: string, status?: string, cursor?: string, sort?: string) => [...appKeys.jobLists(), jobId, { status, cursor, sort }] as const,
  details: () => [...appKeys.all, 'detail'] as const,
  detail: (id: string) => [...appKeys.details(), id] as const,
};

export const useCandidateApplications = (status?: string, cursor?: string) => {
  return useQuery({
    queryKey: appKeys.candidateList(status, cursor),
    queryFn: () => applicationApi.getCandidateApplications(status, cursor),
  });
};

export const useJobApplications = (jobId: string, status?: string, cursor?: string, sort?: string) => {
  return useQuery({
    queryKey: appKeys.jobList(jobId, status, cursor, sort),
    queryFn: () => applicationApi.getJobApplications(jobId, status, cursor, sort),
    enabled: !!jobId,
  });
};

export const useApplicationDetail = (applicationId: string, enabled = true) => {
  return useQuery({
    queryKey: appKeys.detail(applicationId),
    queryFn: () => applicationApi.getApplicationDetail(applicationId),
    enabled: !!applicationId && enabled,
  });
};

export const useSubmitApplication = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      data,
      idempotencyKey,
    }: {
      jobId: string;
      data: SubmitApplicationRequest;
      idempotencyKey?: string;
    }) => applicationApi.submitApplication(jobId, data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.candidateLists() });
    },
  });
};

export const useTransitionApplication = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      data,
      idempotencyKey,
    }: {
      applicationId: string;
      data: TransitionApplicationRequest;
      idempotencyKey?: string;
    }) => applicationApi.transitionApplication(applicationId, data, idempotencyKey),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: appKeys.detail(data.data.id) });
      queryClient.invalidateQueries({ queryKey: appKeys.jobList(data.data.job.id) });
      queryClient.invalidateQueries({ queryKey: appKeys.candidateLists() });
    },
  });
};
