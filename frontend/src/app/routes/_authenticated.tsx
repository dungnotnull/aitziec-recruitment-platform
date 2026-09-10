import { createRoute, redirect } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { AppShell } from '@/shared/ui/AppShell'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async ({ context, location }) => {
    await context.auth.ready
    if (!context.auth.getSession()) {
      throw redirect({
        to: '/auth/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AppShell,
})
