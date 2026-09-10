import { useQuery } from '@tanstack/react-query'
import { operationApi } from './api'
import { getOperationPollInterval } from './polling'

export const operationKeys = {
  all: ['operations'] as const,
  detail: (operationId: string) => [...operationKeys.all, operationId] as const,
}

export function useOperation(operationId: string | null) {
  return useQuery({
    queryKey: operationKeys.detail(operationId ?? ''),
    queryFn: ({ signal }) => operationApi.get(operationId ?? '', signal),
    enabled: Boolean(operationId),
    refetchInterval: (query) => getOperationPollInterval({
      status: query.state.data?.data.status,
      hidden: typeof document !== 'undefined' && document.hidden,
      elapsedMs: query.state.data?.data.createdAt
        ? query.state.dataUpdatedAt - Date.parse(query.state.data.data.createdAt)
        : 0,
    }),
    refetchIntervalInBackground: false,
  })
}
