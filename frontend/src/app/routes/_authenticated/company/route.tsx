import { createRoute } from '@tanstack/react-router'
import { Route as authenticatedRoute } from '../../_authenticated'

export const Route = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/company',
})
