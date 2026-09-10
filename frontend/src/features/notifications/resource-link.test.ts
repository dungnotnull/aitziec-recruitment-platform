import { describe, expect, it } from 'vitest'
import { notificationResourceHref } from './resource-link'

describe('notificationResourceHref', () => {
  it('maps only resource types with safe existing destinations', () => {
    expect(notificationResourceHref({ type: 'APPLICATION', id: 'app-1' }))
      .toBe('/candidate/applications?applicationId=app-1')
    expect(notificationResourceHref({ type: 'JOB', id: 'job-1' })).toBe('/jobs/job-1')
    expect(notificationResourceHref({ type: 'CV', id: 'cv-1' })).toBe('/candidate/cvs?cvId=cv-1')
  })

  it('does not create unsafe links for unknown or unsupported resources', () => {
    expect(notificationResourceHref({ type: 'INTERVIEW', id: 'int-1' })).toBeNull()
    expect(notificationResourceHref({ type: 'UNKNOWN', id: 'private' })).toBeNull()
    expect(notificationResourceHref({ type: 'JOB', id: '../admin' })).toBeNull()
  })
})
