import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import type { CreateCvJobAnalysisRequest } from '@/api/types'
import { aiApi } from './api'

export const aiKeys = {
  all: ['ai-assistance'] as const,
  analyses: () => [...aiKeys.all, 'analyses'] as const,
  analysis: (analysisId: string) => [...aiKeys.analyses(), analysisId] as const,
  recommendations: (limit: number) => [...aiKeys.all, 'recommendations', { limit }] as const,
}

export function useCreateCvJobAnalysis() {
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateCvJobAnalysisRequest; idempotencyKey: string }) =>
      aiApi.createCvJobAnalysis(input, idempotencyKey),
  })
}

export function useAiAnalysis(analysisId: string | null) {
  return useQuery({
    queryKey: aiKeys.analysis(analysisId ?? ''),
    queryFn: ({ signal }) => aiApi.getAnalysis(analysisId ?? '', signal),
    enabled: Boolean(analysisId),
  })
}

export function useRecommendations(limit = 20) {
  return useInfiniteQuery({
    queryKey: aiKeys.recommendations(limit),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => aiApi.getRecommendations(pageParam, limit, signal),
    getNextPageParam: (lastPage) => lastPage.meta.page.hasNextPage
      ? lastPage.meta.page.nextCursor ?? undefined
      : undefined,
  })
}
