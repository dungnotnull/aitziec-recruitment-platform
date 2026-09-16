import { createRoute, redirect } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { AppShell } from '@/shared/ui/AppShell'

function isPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '') return true
  if (pathname === '/jobs' || pathname.startsWith('/jobs/')) return true
  if (pathname === '/companies' || pathname.startsWith('/companies/')) return true
  return false
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async ({ context, location }) => {
    await context.auth.ready
    if (!isPublicPath(location.pathname) && !context.auth.getSession()) {
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
