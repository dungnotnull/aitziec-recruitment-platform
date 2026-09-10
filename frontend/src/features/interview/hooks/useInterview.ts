import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interviewApi } from '../api/interview.api';
import type { CreateInterviewRequest, UpdateInterviewRequest } from '@/api/types';

export const interviewKeys = {
  all: ['interviews'] as const,
  lists: () => [...interviewKeys.all, 'list'] as const,
  list: (applicationId: string, cursor?: string) => [...interviewKeys.lists(), applicationId, { cursor }] as const,
};

export const useInterviews = (applicationId: string, cursor?: string) => {
  return useQuery({
    queryKey: interviewKeys.list(applicationId, cursor),
    queryFn: () => interviewApi.getInterviews(applicationId, cursor),
    enabled: !!applicationId,
  });
};

export const useCreateInterview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      data,
      idempotencyKey,
    }: {
      applicationId: string;
      data: CreateInterviewRequest;
      idempotencyKey?: string;
    }) => interviewApi.createInterview(applicationId, data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
    },
  });
};

export const useUpdateInterview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ interviewId, data }: { interviewId: string; data: UpdateInterviewRequest }) =>
      interviewApi.updateInterview(interviewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
    },
  });
};

export const useCompleteInterview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      interviewId,
      expectedVersion,
      recruiterFeedback,
    }: {
      interviewId: string;
      expectedVersion: number;
      recruiterFeedback?: string;
    }) => interviewApi.completeInterview(interviewId, expectedVersion, recruiterFeedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
    },
  });
};

export const useCancelInterview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      interviewId,
      expectedVersion,
      reason,
    }: {
      interviewId: string;
      expectedVersion: number;
      reason: string;
    }) => interviewApi.cancelInterview(interviewId, expectedVersion, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.lists() });
    },
  });
};
