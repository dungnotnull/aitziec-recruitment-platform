import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvApi } from '../api/cv.api';

export const cvKeys = {
  all: ['cvs'] as const,
  lists: () => [...cvKeys.all, 'list'] as const,
  list: (cursor?: string) => [...cvKeys.lists(), { cursor }] as const,
  details: () => [...cvKeys.all, 'detail'] as const,
  detail: (id: string) => [...cvKeys.details(), id] as const,
};

export const useCvs = (cursor?: string) => {
  return useQuery({
    queryKey: cvKeys.list(cursor),
    queryFn: () => cvApi.getCvs(cursor),
  });
};

export const useCv = (cvId: string, enabled = true) => {
  return useQuery({
    queryKey: cvKeys.detail(cvId),
    queryFn: () => cvApi.getCv(cvId),
    enabled: !!cvId && enabled,
  });
};

export const useUploadCv = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => cvApi.uploadCv(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    },
  });
};

export const useSetDefaultCv = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cvId, expectedVersion }: { cvId: string; expectedVersion: number }) =>
      cvApi.setDefaultCv(cvId, expectedVersion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    },
  });
};

export const useDeleteCv = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cvId: string) => cvApi.deleteCv(cvId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvKeys.lists() });
    },
  });
};

export const useDownloadCv = () => {
  return useMutation({
    mutationFn: (cvId: string) => cvApi.getDownloadUrl(cvId),
  });
};
