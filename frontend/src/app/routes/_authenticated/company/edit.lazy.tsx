import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getCompany } from '@/features/company/api'
import { CompanyProfileEditor } from '@/features/company/components/CompanyProfileEditor'
import { StateBoundary } from '@/shared/ui/state-boundary'
import { useAuth } from '@/features/auth/context'

export const Route = createLazyFileRoute('/_authenticated/company/edit')({
  component: CompanyEditRoute,
})

function CompanyEditRoute() {
  const { session } = useAuth()
  const { companyId } = Route.useSearch()

  const { data: company, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId!),
    enabled: !!session && session.user.role === 'HR' && Boolean(companyId),
    retry: false
  })

  if (!session || session.user.role !== 'HR') {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-danger">Access Denied</h2>
        <p className="mt-2 text-slate">You do not have permission to view this page.</p>
      </div>
    )
  }

  return (
    <StateBoundary isLoading={Boolean(companyId) && isLoading} isError={isError} error={error} onRetry={() => refetch()}>
      <CompanyProfileEditor company={company} />
    </StateBoundary>
  )
}
