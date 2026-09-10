import { apiClient } from '@/api/client'
import type { Operation, SuccessResponse } from '@/api/types'

export const operationApi = {
  async get(operationId: string, signal?: AbortSignal): Promise<SuccessResponse<Operation>> {
    const response = await apiClient.get<SuccessResponse<Operation>>(
      `/operations/${encodeURIComponent(operationId)}`,
      { signal },
    )
    return response.data
  },
}
