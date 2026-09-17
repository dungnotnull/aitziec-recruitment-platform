const safeId = /^[A-Za-z0-9_-]+$/

export function notificationResourceHref(
  resource: { type: string; id: string } | null,
  notificationType?: string,
  userRole?: string,
): string | null {
  if (!resource || !safeId.test(resource.id)) return null

  switch (resource.type) {
    case 'APPLICATION':
      if (userRole === 'HR') {
        return `/recruiter/workspace`
      }
      return `/candidate/applications?applicationId=${encodeURIComponent(resource.id)}`
    case 'JOB':
      if (notificationType === 'JOB_PENDING_APPROVAL' || userRole === 'HR') {
        return `/recruiter/workspace`
      }
      return `/jobs/${encodeURIComponent(resource.id)}`
    case 'CV':
      return `/candidate/cvs?cvId=${encodeURIComponent(resource.id)}`
    case 'INTERVIEW':
      return `/interviews/${encodeURIComponent(resource.id)}`
    case 'COMPANY':
      return `/company`
    default:
      return null
  }
}
