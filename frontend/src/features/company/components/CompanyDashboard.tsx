import { useAuth } from "@/features/auth/context"
import { useQuery } from "@tanstack/react-query"
import { getCompany } from "../api"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Building, Users, Briefcase, Edit, Globe, MapPin } from "lucide-react"

import { MemberDirectory } from "./MemberDirectory"
import { StateBoundary } from "@/shared/ui/state-boundary"
import { Link } from "@tanstack/react-router"
import { useJobs } from "@/features/job/hooks/useJobs"

export function CompanyDashboard({ companyId }: { companyId?: string }) {
  const { session } = useAuth()

  const parsedCompanyId = companyId === 'undefined' ? undefined : companyId;
  const activeCompanyId = parsedCompanyId || localStorage.getItem('hr_company_id') || undefined;

  const { data: company, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['company', activeCompanyId],
    queryFn: () => getCompany(activeCompanyId!),
    enabled: !!session && session.user.role === 'HR' && Boolean(activeCompanyId),
    retry: false
  })

  const jobsQuery = useJobs(
    company ? { companyId: company.id } : undefined,
    { enabled: Boolean(company) },
  )

  if (!session || session.user.role !== 'HR') {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-danger">Access Denied</h2>
        <p className="mt-2 text-slate">You do not have permission to view the company dashboard.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-ink">Company Dashboard</h2>
          <p className="text-slate">Manage your organization, jobs, and team members.</p>
        </div>
        <div className="flex gap-2">
          {company && (
            <Link to="/company/edit" search={{ companyId }}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </Link>
          )}
          {company ? <Button asChild><Link to="/recruiter/workspace" search={{ companyId: company.id }}>Manage jobs</Link></Button> : null}
        </div>
      </div>

      <StateBoundary isLoading={Boolean(companyId) && isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {company ? (
          <>
            {/* Scoped Company Profile View */}
            <Card className="bg-surface/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt={`${company.name} logo`} className="w-16 h-16 rounded-md object-cover border border-border" />
                    ) : (
                      <div className="w-16 h-16 rounded-md bg-slate/10 flex items-center justify-center border border-border">
                        <Building className="h-8 w-8 text-slate" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-ink">{company.name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate">
                        {company.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {company.location}
                          </span>
                        )}
                        {company.websiteUrl && (
                          <a href={company.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-action hover:underline">
                            <Globe className="h-3 w-3" /> {company.websiteUrl.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${company.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-slate/10 text-slate'}`}>
                    {company.status}
                  </span>
                </div>
                {company.description && (
                  <div className="mt-4 text-sm text-ink whitespace-pre-wrap">
                    {company.description}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Organization</CardTitle>
                  <Building className="h-4 w-4 text-slate" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{company.name}</div>
                  <p className="text-xs text-slate mt-1">Slug: {company.slug}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <Briefcase className="h-4 w-4 text-slate" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobsQuery.isLoading ? '—' : jobsQuery.data?.data.length ?? 0}
                  </div>
                  <p className="text-xs text-slate mt-1">
                    {jobsQuery.isError ? 'Unable to load jobs' : 'Published jobs returned by the API'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Location</CardTitle>
                  <Users className="h-4 w-4 text-slate" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold truncate">{company.location || 'N/A'}</div>
                  <p className="text-xs text-slate mt-1">HQ</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8">
              <MemberDirectory companyId={company.id} />
            </div>
          </>
        ) : (
           <div className="text-center p-8 border border-dashed border-border rounded-md">
            <h3 className="text-lg font-medium text-ink mb-2">No Company Profile Found</h3>
            <p className="text-slate mb-6">You haven't set up a company profile yet.</p>
            <p className="text-slate mb-6">Create a company profile to get started with posting jobs and managing your team.</p>
            <Link to="/company/edit" search={{ companyId: undefined }}>
              <Button>Create Company Profile</Button>
            </Link>
          </div>
        )}
      </StateBoundary>
    </div>
  )
}
