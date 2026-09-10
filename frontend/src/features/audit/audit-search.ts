import type { AuditLogFilters } from '@/api/types'

const safeId = /^[A-Za-z0-9_-]+$/

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

export function normalizeAuditSearch(search: Record<string, unknown>): AuditLogFilters {
  const result: AuditLogFilters = {}
  const actorId = text(search.actorId)
  const action = text(search.action)
  const targetType = text(search.targetType)
  const targetId = text(search.targetId)
  const occurredAfter = text(search.occurredAfter)
  const occurredBefore = text(search.occurredBefore)
  const cursor = text(search.cursor)
  const rawLimit = typeof search.limit === 'number' ? search.limit : Number(text(search.limit))
  if (actorId && safeId.test(actorId)) result.actorId = actorId
  if (action && safeId.test(action)) result.action = action
  if (targetType && safeId.test(targetType)) result.targetType = targetType
  if (targetId && safeId.test(targetId)) result.targetId = targetId
  if (occurredAfter && !Number.isNaN(Date.parse(occurredAfter))) result.occurredAfter = occurredAfter
  if (occurredBefore && !Number.isNaN(Date.parse(occurredBefore))) result.occurredBefore = occurredBefore
  if (cursor && safeId.test(cursor)) result.cursor = cursor
  if (Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 100) result.limit = rawLimit
  return result
}
