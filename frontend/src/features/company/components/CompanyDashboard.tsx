import { useState, useEffect } from "react"
import { useAuth } from "@/features/auth/context"
import { useQuery } from "@tanstack/react-query"
import { getCompany, listMyCompanies } from "../api"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Building, Users, Briefcase, Edit, Globe, MapPin, MailCheck, ExternalLink } from "lucide-react"

import { MemberDirectory } from "./MemberDirectory"
import { AcceptInvitationModal } from "./AcceptInvitationModal"
import { StateBoundary } from "@/shared/ui/state-boundary"
import { Link, useNavigate } from "@tanstack/react-router"
import { useCompanyJobs } from "@/features/job/hooks/useJobs"
import { listMyHrInvitations } from "@/features/hr/api"
import { getCompanyExtendedInfo } from "../company-meta"
import type { HrInvitationItem } from "@/api/types"

export function CompanyDashboard({ companyId }: { companyId?: string }) {
  const { session } = useAuth()
  const navigate = useNavigate()

  const parsedCompanyId = companyId === 'undefined' ? undefined : companyId;
  const cachedId = localStorage.getItem('hr_company_id') || undefined;

  const myCompaniesQuery = useQuery({
    queryKey: ['my-companies'],
    queryFn: () => listMyCompanies(),
    enabled: !!session && session.user.role === 'HR',
  })

  const myCompanies = myCompaniesQuery.data;
  let activeCompanyId: string | undefined = undefined;

  if (myCompanies) {
    if (parsedCompanyId && myCompanies.some(m => m.company.id === parsedCompanyId)) {
      activeCompanyId = parsedCompanyId;
    } else if (cachedId && myCompanies.some(m => m.company.id === cachedId)) {
      activeCompanyId = cachedId;
    } else if (myCompanies.length > 0) {
      activeCompanyId = myCompanies[0].company.id;
      localStorage.setItem('hr_company_id', activeCompanyId);
    }
  }

  const { data: company, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['company', activeCompanyId],
    queryFn: () => getCompany(activeCompanyId!),
    enabled: !!session && session.user.role === 'HR' && Boolean(activeCompanyId),
    retry: false
  })

  const [logoError, setLogoError] = useState(false)
  useEffect(() => {
    setLogoError(false)
  }, [company?.logoUrl])

  const jobsQuery = useCompanyJobs(
    company?.id,
    undefined,
    { enabled: Boolean(company) },
  )

  const { data: hrInvData } = useQuery({
    queryKey: ['hr-invitations'],
    queryFn: () => listMyHrInvitations(),
    enabled: !!session && session.user.role === 'HR',
  })
  const pendingInvitations = hrInvData?.data || []
  const [acceptModalInvite, setAcceptModalInvite] = useState<HrInvitationItem | null>(null)

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-ink">Company Dashboard</h2>
            <p className="text-slate">Manage your organization, jobs, and team members.</p>
          </div>
          
          {myCompaniesQuery.data && myCompaniesQuery.data.length > 0 && (
            <div className="ml-4 pl-4 border-l">
              <select 
                className="h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                value={activeCompanyId || ''}
                onChange={(e) => {
                  const newId = e.target.value;
                  localStorage.setItem('hr_company_id', newId);
                  navigate({ to: '/company', search: { companyId: newId } });
                }}
              >
                <option value="" disabled>Select a company</option>
                {myCompaniesQuery.data.map((item) => (
                  <option key={item.company.id} value={item.company.id}>
                    {item.company.name} ({item.membership.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {company && (
            <Link
              to="/companies/$companyIdOrSlug"
              params={{ companyIdOrSlug: company.slug || company.id }}
              target="_blank"
            >
              <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50">
                <ExternalLink className="mr-2 h-4 w-4" />
                Xem trang công ty public
              </Button>
            </Link>
          )}
          {company && (
            <Link to="/company/edit" search={{ companyId: company.id }}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </Link>
          )}
          {company ? <Button asChild><Link to="/recruiter/workspace" search={{ companyId: company.id }}>Manage jobs</Link></Button> : null}
        </div>
      </div>

      {/* Notification banner when user has pending invitations for another company */}
      {company && pendingInvitations.length > 0 && (
        <div className="rounded-lg border border-action/30 bg-action/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MailCheck className="h-5 w-5 text-action shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ink">
                You have {pendingInvitations.length} pending company invitation{pendingInvitations.length > 1 ? 's' : ''}.
              </p>
              <p className="text-xs text-slate">
                {pendingInvitations[0].company.name} invited you to join as {pendingInvitations[0].role}.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setAcceptModalInvite(pendingInvitations[0])}>
            Review Invitation
          </Button>
        </div>
      )}

      <StateBoundary isLoading={Boolean(companyId) && isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {company ? (
          <>
            {/* Scoped Company Profile View */}
            <Card className="bg-surface/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    {company.logoUrl && !logoError ? (
                      <img
                        src={company.logoUrl}
                        alt={`${company.name} logo`}
                        className="w-16 h-16 rounded-md object-cover border border-border"
                        onError={() => setLogoError(true)}
                      />
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
                  <p className="text-xs text-slate mt-1">Mô hình: {getCompanyExtendedInfo(company.id).companyModel}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <Briefcase className="h-4 w-4 text-slate" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jobsQuery.data?.data?.length ?? 0}
                  </div>
                  <p className="text-xs text-slate mt-1">Quy mô: {getCompanyExtendedInfo(company.id).companySize}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Location</CardTitle>
                  <Users className="h-4 w-4 text-slate" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold truncate">{company.location || 'N/A'}</div>
                  <p className="text-xs text-slate mt-1">HQ ({getCompanyExtendedInfo(company.id).country})</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8">
              <MemberDirectory companyId={company.id} />
            </div>
          </>
        ) : pendingInvitations.length > 0 ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-action/40 bg-action/5 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <MailCheck className="h-5 w-5 text-action" />
                <h3 className="text-lg font-bold text-ink">Pending Company Invitations</h3>
              </div>
              <p className="text-sm text-slate mb-6">
                You have received the following invitation(s) to join an existing organization as a Recruiter. Accept your invitation below to access the company workspace.
              </p>
              <div className="space-y-4">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-border shadow-xs">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-action/10 rounded-full text-action shrink-0">
                        <Building className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-ink text-base">{inv.company.name}</h4>
                        <p className="text-sm text-slate">
                          Role: <span className="font-semibold text-action">{inv.role}</span>
                        </p>
                        <p className="text-xs text-slate mt-0.5">
                          Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => setAcceptModalInvite(inv)}>
                      Accept Invitation
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center p-6 border border-dashed border-border rounded-md">
              <h4 className="text-base font-medium text-ink mb-1">Want to create your own company instead?</h4>
              <p className="text-sm text-slate mb-4">You can also register a brand new organization profile.</p>
              <Link to="/company/edit" search={{ companyId: undefined }}>
                <Button variant="outline">Create New Company</Button>
              </Link>
            </div>
          </div>
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

      <AcceptInvitationModal
        open={Boolean(acceptModalInvite)}
        onOpenChange={(open) => {
          if (!open) setAcceptModalInvite(null)
        }}
        companyName={acceptModalInvite?.company.name}
      />
    </div>
  )
}
