import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getMyCompanies } from '@/features/company/api'
import { CompanyProfileEditor } from '@/features/company/components/CompanyProfileEditor'
import { StateBoundary } from '@/shared/ui/state-boundary'
import { useAuth } from '@/features/auth/context'

export const Route = createLazyFileRoute('/_authenticated/company/edit')({
  component: CompanyEditRoute,
})

function CompanyEditRoute() {
  const { session } = useAuth()

  const { data: companies, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-companies'],
    queryFn: getMyCompanies,
    enabled: !!session && session.user.role === 'HR',
    retry: false
  })

  const company = companies && companies.length > 0 ? companies[0] : undefined;

  // If it's a 404, we allow creating a new company
  const isNotFound = (error as any)?.response?.status === 404
  const shouldShowError = isError && !isNotFound

  if (!session || session.user.role !== 'HR') {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-danger">Access Denied</h2>
        <p className="mt-2 text-slate">You do not have permission to view this page.</p>
      </div>
    )
  }

  return (
    <StateBoundary isLoading={isLoading} isError={shouldShowError} error={error} onRetry={() => refetch()}>
      <CompanyProfileEditor company={company} />
    </StateBoundary>
  )
}
