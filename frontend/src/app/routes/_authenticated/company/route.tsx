import { createRoute } from '@tanstack/react-router'
import { Route as authenticatedRoute } from '../../_authenticated'
import { normalizeCompanyTarget } from '@/features/company/company-context'

export const Route = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/company',
  validateSearch: (search: Record<string, unknown>) => ({
    companyId: normalizeCompanyTarget(search.companyId),
  }),
})
