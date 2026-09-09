import * as React from "react"
import { useAuth } from "@/features/auth/context"
import { useQuery } from "@tanstack/react-query"
import { getCompany } from "../api"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Building, Users, Briefcase } from "lucide-react"
import { MemberDirectory } from "./MemberDirectory"
import { StateBoundary } from "@/shared/ui/state-boundary"

export function CompanyDashboard() {
  const { session } = useAuth()

  // Hardcoded for now as backend doesn't have an endpoint to list current user's companies
  const companySlug = 'techcorp-vietnam'

  const { data: company, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['company', companySlug],
    queryFn: () => getCompany(companySlug),
    enabled: !!session && session.user.role === 'HR',
    retry: false // don't retry 404s endlessly
  })

  if (!session || session.user.role !== 'HR') {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-danger">Access Denied</h2>
        <p className="mt-2 text-slate">You do not have permission to view the company dashboard.</p>
      </div>
    )
  }

  // If it's a 404, we don't treat it as a general unexpected error for the StateBoundary
  const isNotFound = (error as any)?.response?.status === 404;
  const shouldShowError = isError && !isNotFound;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-ink">Company Dashboard</h2>
          <p className="text-slate">Manage your organization, jobs, and team members.</p>
        </div>
        <Button>Post New Job</Button>
      </div>

      <StateBoundary isLoading={isLoading} isError={shouldShowError} error={error} onRetry={() => refetch()}>
        {company ? (
          <>
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Organization</CardTitle>
                  <Building className="h-4 w-4 text-slate" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{company.name}</div>
                  <p className="text-xs text-slate mt-1">Status: {company.status}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <Briefcase className="h-4 w-4 text-slate" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-slate mt-1">+2 this week</p>
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
            <Button>Create Company Profile</Button>
          </div>
        )}
      </StateBoundary>
    </div>
  )
}
