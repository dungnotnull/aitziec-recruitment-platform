import { createRoute } from '@tanstack/react-router'
import { Route as authenticatedRoute } from '../../_authenticated'
import { AdminRouteBoundary } from '@/features/admin/AdminRouteBoundary'

export const Route = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/admin',
  component: AdminRouteBoundary,
})
