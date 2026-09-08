import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { QueryClient } from '@tanstack/react-query'
import type { AuthSession } from '@/api/types'

interface MyRouterContext {
  auth: {
    session: AuthSession | null
    isAuthenticated: boolean
    setSession: (session: AuthSession | null) => void
  }
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
