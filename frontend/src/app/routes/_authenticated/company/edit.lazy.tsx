import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getCompany, listMyCompanies } from '@/features/company/api'
import { CompanyProfileEditor } from '@/features/company/components/CompanyProfileEditor'
import { StateBoundary } from '@/shared/ui/state-boundary'
import { useAuth } from '@/features/auth/context'
import { Button } from '@/shared/ui/button'
import { Link } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/_authenticated/company/edit')({
  component: CompanyEditRoute,
})

function CompanyEditRoute() {
  const { session } = useAuth()
  const { companyId } = Route.useSearch()

  // Fetch company details
  const { data: company, isLoading: isLoadingCompany, isError: isErrorCompany, error: errorCompany, refetch: refetchCompany } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId!),
    enabled: !!session && session.user.role === 'HR' && Boolean(companyId),
    retry: false
  })

  // Fetch HR's company memberships to check role
  const { data: memberships, isLoading: isLoadingMemberships, isError: isErrorMemberships, error: errorMemberships, refetch: refetchMemberships } = useQuery({
    queryKey: ['my-companies'],
    queryFn: listMyCompanies,
    enabled: !!session && session.user.role === 'HR',
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

  const isLoading = isLoadingCompany || isLoadingMemberships
  const isError = isErrorCompany || isErrorMemberships
  const error = errorCompany || errorMemberships
  
  // Check permission
  const membership = memberships?.find(m => m.company.id === companyId)
  const isOwner = membership?.membership.role === 'OWNER'

  if (!isLoading && !isError && companyId && memberships && !isOwner) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-center max-w-md mx-auto">
        <div className="p-4 bg-danger/10 text-danger rounded-full mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-ink">Permission Denied</h2>
        <p className="mt-2 text-slate mb-6">
          Only the Company Owner is allowed to edit the company profile. Please contact the owner if you need changes.
        </p>
        <Link to="/company" search={{ companyId }}>
          <Button variant="outline">Back to Company Dashboard</Button>
        </Link>
      </div>
    )
  }

  return (
    <StateBoundary isLoading={Boolean(companyId) && isLoading} isError={isError} error={error} onRetry={() => { refetchCompany(); refetchMemberships(); }}>
      <CompanyProfileEditor company={company} />
    </StateBoundary>
  )
}

