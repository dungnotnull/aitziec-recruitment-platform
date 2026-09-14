import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { acceptCompanyInvitation } from '../api'
import { getApiErrorDetails } from '@/shared/lib/api-error'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { AlertCircle, CheckCircle2, KeyRound, Mail, ExternalLink } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

interface AcceptInvitationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyName?: string
  initialToken?: string
  onSuccess?: () => void
}

export function AcceptInvitationModal({
  open,
  onOpenChange,
  companyName,
  initialToken = '',
  onSuccess,
}: AcceptInvitationModalProps) {
  const [token, setToken] = React.useState(initialToken)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (initialToken) {
      setToken(initialToken)
    }
  }, [initialToken])

  React.useEffect(() => {
    if (!open) {
      setErrorMessage(null)
      setIsSuccess(false)
    }
  }, [open])

  const acceptMutation = useMutation({
    mutationFn: (tokenValue: string) => acceptCompanyInvitation(tokenValue),
    onSuccess: (membership) => {
      setIsSuccess(true)
      setErrorMessage(null)
      queryClient.invalidateQueries({ queryKey: ['hr-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['my-companies'] })
      queryClient.invalidateQueries({ queryKey: ['company-members'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-summary'] })
      if (membership.companyId) {
        localStorage.setItem('hr_company_id', membership.companyId)
      }
      onSuccess?.()
    },
    onError: (error) => {
      const details = getApiErrorDetails(error)
      setErrorMessage(details.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    acceptMutation.mutate(token.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-5 w-5 text-action" />
            <DialogTitle>Accept Company Invitation</DialogTitle>
          </div>
          <DialogDescription>
            {companyName
              ? `You have been invited to join ${companyName} as a Recruiter.`
              : 'Join the organization with recruiter access to post jobs and manage applicants.'}
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="space-y-4 py-3">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold">Welcome to the team!</p>
                <p className="text-sm mt-0.5">Your invitation has been accepted and your recruiter membership is active.</p>
              </div>
            </div>
            <DialogFooter>
              <Button
                className="w-full"
                onClick={() => {
                  onOpenChange(false)
                  navigate({ to: '/company', search: { companyId: undefined } })
                }}
              >
                Go to Company Dashboard
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {errorMessage && (
              <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="rounded-md border border-border bg-slate/5 p-3 text-xs text-slate space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <Mail className="h-3.5 w-3.5 text-action" />
                <span>Where to find your invitation token?</span>
              </div>
              <p>
                A secure link was sent to your email. You can copy the token from the link or view local emails in{' '}
                <a
                  href="http://localhost:8025"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-action underline inline-flex items-center gap-0.5"
                >
                  Mailpit (http://localhost:8025)
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="invitation-token" className="text-sm font-medium text-ink">
                Invitation Token
              </label>
              <Input
                id="invitation-token"
                placeholder="Paste the invitation token (e.g. 64-character hash)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={acceptMutation.isPending}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={acceptMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!token.trim() || acceptMutation.isPending}
              >
                {acceptMutation.isPending ? 'Verifying...' : 'Accept & Join Company'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
