import { createRoute, redirect } from '@tanstack/react-router'
import { Route as authRoute } from '../_authenticated'

export const Route = createRoute({
  getParentRoute: () => authRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    if (context.auth.getSession()?.user.role === 'HR') {
      throw redirect({ to: '/company', search: { companyId: undefined } })
    } else {
      throw redirect({ to: '/profile' })
    }
  }
})
