const allowedKeys = new Set([
  'reason', 'previousStatus', 'newStatus', 'status', 'action', 'requestId',
  'companyId', 'jobId', 'applicationId', 'interviewId', 'userId', 'changedFields',
])

function safeValue(value: unknown): unknown {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
  return undefined
}

export function sanitizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  Object.entries(metadata).forEach(([key, value]) => {
    if (!allowedKeys.has(key)) return
    const sanitized = safeValue(value)
    if (sanitized !== undefined) result[key] = sanitized
  })
  return result
}
