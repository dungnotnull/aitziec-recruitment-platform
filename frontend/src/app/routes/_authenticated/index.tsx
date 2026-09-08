import { createRoute } from '@tanstack/react-router'
import { Route as authRoute } from '../_authenticated'
import { AppShell } from '@/shared/ui/AppShell'

export const Route = createRoute({
  getParentRoute: () => authRoute,
  path: '/',
  component: AppShell,
})
