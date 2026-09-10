const safeId = /^[A-Za-z0-9_-]+$/

export function notificationResourceHref(resource: { type: string; id: string } | null): string | null {
  if (!resource || !safeId.test(resource.id)) return null

  switch (resource.type) {
    case 'APPLICATION':
      return `/candidate/applications?applicationId=${encodeURIComponent(resource.id)}`
    case 'JOB':
      return `/jobs/${encodeURIComponent(resource.id)}`
    case 'CV':
      return `/candidate/cvs?cvId=${encodeURIComponent(resource.id)}`
    case 'INTERVIEW':
      return `/interviews/${encodeURIComponent(resource.id)}`
    default:
      return null
  }
}
