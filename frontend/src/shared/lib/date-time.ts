function parseTimestamp(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatUtcDateTime(value: string, locale = 'en-US', timeZone = 'UTC'): string {
  const date = parseTimestamp(value)
  if (!date) return 'Unknown time'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date)
}

export function formatUtcDate(value: string, locale = 'en-US', timeZone = 'UTC'): string {
  const date = parseTimestamp(value)
  if (!date) return 'Unknown date'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(date)
}
