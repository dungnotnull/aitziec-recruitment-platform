import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import type { AuthSession } from '@/api/types'

const RouterDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('@tanstack/router-devtools')
      return { default: module.TanStackRouterDevtools }
    })
  : null

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
      {RouterDevtools && (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      )}
    </>
  ),
})
