import type { OperationStatus } from '@/api/types'

const terminalStatuses = new Set<OperationStatus>(['SUCCEEDED', 'FAILED'])

export function getOperationPollInterval(input: {
  status?: OperationStatus
  hidden: boolean
  elapsedMs: number
}): 2000 | false {
  if (input.hidden || input.elapsedMs >= 300_000 || (input.status && terminalStatuses.has(input.status))) {
    return false
  }
  return 2000
}

export function hasOperationTimedOut(input: {
  status: OperationStatus
  createdAt: string
  observedAt: number
}): boolean {
  return !terminalStatuses.has(input.status)
    && input.observedAt - Date.parse(input.createdAt) >= 300_000
}
