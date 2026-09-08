import * as React from "react"
import { useAuth } from "@/features/auth/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Building, Users, Briefcase } from "lucide-react"
import { MemberDirectory } from "./MemberDirectory"

export function CompanyDashboard() {
  const { session } = useAuth()

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
        <Button>Post New Job</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organization</CardTitle>
            <Building className="h-4 w-4 text-slate" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Acme Corp</div>
            <p className="text-xs text-slate mt-1">Status: VERIFIED</p>
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
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-slate" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-slate mt-1">2 pending invites</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <MemberDirectory />
      </div>
    </div>
  )
}
