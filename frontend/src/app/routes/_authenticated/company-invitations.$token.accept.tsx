import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { acceptCompanyInvitation } from '@/features/company/api'
import { useAuth } from '@/features/auth/context'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Building, CheckCircle2, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/company-invitations/$token/accept')({
  component: AcceptInvitationPage,
})

function AcceptInvitationPage() {
  const { token } = Route.useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)

  const acceptMutation = useMutation({
    mutationFn: () => acceptCompanyInvitation(token),
    onSuccess: (membership) => {
      setIsSuccess(true)
      setErrorMessage(null)
      // Invalidate company queries so the user immediately sees their new company
      queryClient.invalidateQueries({ queryKey: ['my-companies'] })
      queryClient.invalidateQueries({ queryKey: ['hr-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['company-members'] })
      if (membership.companyId) {
        localStorage.setItem('hr_company_id', membership.companyId)
      }
    },
    onError: (error) => {
      const details = getApiErrorDetails(error)
      setErrorMessage(details.message)
    },
  })

  if (!session) return null

  if (session.user.role !== 'HR') {
    return (
      <div className="container mx-auto max-w-lg py-16 px-4">
        <Card className="border-warning/40 shadow-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Role Incompatible</CardTitle>
            <CardDescription>
              Only active HR / Recruiter accounts can accept company invitations.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-slate">
            You are currently logged in as a <strong>{session.user.role}</strong> ({session.user.email}).
            Please log in with your HR account to accept this invitation.
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link to="/auth/login" search={{ redirect: window.location.href }}>
              <Button variant="outline">Switch Account</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-lg py-16 px-4">
      <Card className="border-border shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-action/10 text-action">
            {isSuccess ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            ) : (
              <Building className="h-8 w-8 text-action" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {isSuccess ? 'Invitation Accepted!' : 'Company Invitation'}
          </CardTitle>
          <CardDescription>
            {isSuccess
              ? 'You are now an active team member of the organization.'
              : 'You have been invited to join the company as Recruiter.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to accept invitation</p>
                <p className="mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm text-emerald-800 dark:text-emerald-300">
              Your membership has been confirmed! You now have recruiter access to create and manage job postings and applicants.
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-slate/5 p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate">Logged in as:</span>
                <span className="font-medium text-ink">{session.user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate">Target Role:</span>
                <span className="font-medium text-action">Recruiter</span>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end border-t border-border pt-4">
          {isSuccess ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => navigate({ to: '/company', search: { companyId: undefined } })}
            >
              Go to Company Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Link to="/profile">
                <Button variant="ghost" className="w-full sm:w-auto">
                  Cancel
                </Button>
              </Link>
              <Button
                className="w-full sm:w-auto"
                disabled={acceptMutation.isPending}
                onClick={() => acceptMutation.mutate()}
              >
                {acceptMutation.isPending ? 'Accepting...' : 'Accept Invitation'}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
