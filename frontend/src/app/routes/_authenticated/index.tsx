import { createRoute, redirect } from '@tanstack/react-router'
import { Route as authRoute } from '../_authenticated'

export const Route = createRoute({
  getParentRoute: () => authRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    if (context.auth.session?.user.role === 'HR') {
      throw redirect({ to: '/company' })
    } else {
      throw redirect({ to: '/profile' })
    }
  }
})
