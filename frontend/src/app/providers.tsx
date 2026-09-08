import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
// Import the generated route tree
import { routeTree } from './routeTree.gen'

import { AuthProvider, useAuth } from '@/features/auth/context'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // injected below
  },
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function InnerProviders() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerProviders />
      </AuthProvider>
    </QueryClientProvider>
  )
}
