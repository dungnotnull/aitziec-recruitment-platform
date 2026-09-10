import type { EmploymentType, ExperienceLevel, JobSearchFilters, WorkplaceType } from '@/api/types'

const experienceLevels = new Set<ExperienceLevel>(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'])
const employmentTypes = new Set<EmploymentType>(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'])
const workplaceTypes = new Set<WorkplaceType>(['ONSITE', 'HYBRID', 'REMOTE'])
const sorts = new Set<NonNullable<JobSearchFilters['sort']>>(['RELEVANCE', 'NEWEST', 'SALARY_ASC', 'SALARY_DESC'])
const safeOpaqueValue = /^[A-Za-z0-9_-]+$/

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function stringArray(value: unknown): string[] | undefined {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const normalized = values.flatMap((item) => typeof item === 'string' && item.trim() ? [item.trim()] : [])
  return normalized.length ? [...new Set(normalized)] : undefined
}

function enumArray<T extends string>(value: unknown, allowed: Set<T>): T[] | undefined {
  const values = stringArray(value)?.filter((item): item is T => allowed.has(item as T))
  return values?.length ? values : undefined
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

export function normalizeJobSearch(search: Record<string, unknown>): JobSearchFilters {
  const result: JobSearchFilters = {}
  const q = text(search.q)
  const technology = stringArray(search.technology)
  const location = stringArray(search.location)
  const experienceLevel = enumArray(search.experienceLevel, experienceLevels)
  const employmentType = enumArray(search.employmentType, employmentTypes)
  const workplaceType = enumArray(search.workplaceType, workplaceTypes)
  const companyId = text(search.companyId)
  const salaryMin = numberValue(search.salaryMin)
  const salaryMax = numberValue(search.salaryMax)
  const currency = text(search.currency)?.toUpperCase()
  const publishedAfter = text(search.publishedAfter)
  const sort = text(search.sort)
  const cursor = text(search.cursor)
  const limit = numberValue(search.limit)

  if (q) result.q = q
  if (technology) result.technology = technology
  if (location) result.location = location
  if (experienceLevel) result.experienceLevel = experienceLevel
  if (employmentType) result.employmentType = employmentType
  if (workplaceType) result.workplaceType = workplaceType
  if (companyId && safeOpaqueValue.test(companyId)) result.companyId = companyId
  if (salaryMin !== undefined) result.salaryMin = salaryMin
  if (salaryMax !== undefined) result.salaryMax = salaryMax
  if (currency && /^[A-Z]{3}$/.test(currency)) result.currency = currency
  if (publishedAfter && !Number.isNaN(Date.parse(publishedAfter))) result.publishedAfter = publishedAfter
  if (sort && sorts.has(sort as NonNullable<JobSearchFilters['sort']>)) result.sort = sort as NonNullable<JobSearchFilters['sort']>
  if (cursor && safeOpaqueValue.test(cursor)) result.cursor = cursor
  if (limit !== undefined && Number.isInteger(limit) && limit >= 1 && limit <= 100) result.limit = limit
  return result
}
