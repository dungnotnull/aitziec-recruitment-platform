import * as React from "react"
import { useAuth } from "@/features/auth/context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getMyHrProfile, updateMyHrProfile, listMyHrInvitations } from "@/features/hr/api"
import { acceptCompanyInvitation } from "@/features/company/api"
import { getApiErrorDetails } from "@/shared/lib/api-error"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog"
import { useForm, useWatch } from "react-hook-form"
import { Building, CheckCircle, Mail, AlertCircle, KeyRound, ExternalLink } from "lucide-react"
import { Avatar } from "@/shared/ui/avatar"

type ProfileFormValues = {
  fullName: string;
  phone: string;
  avatarUrl: string;
}

export function AccountSettingsOverview() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  const [profileSuccessNotice, setProfileSuccessNotice] = React.useState<string | null>(null)
  const [profileErrorNotice, setProfileErrorNotice] = React.useState<string | null>(null)

  // Token dialog state
  const [tokenModalOpen, setTokenModalOpen] = React.useState(false)
  const [inputToken, setInputToken] = React.useState("")
  const [acceptError, setAcceptError] = React.useState<string | null>(null)
  const [acceptSuccess, setAcceptSuccess] = React.useState<string | null>(null)

  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<ProfileFormValues>({
    defaultValues: {
      fullName: "",
      phone: "",
      avatarUrl: ""
    }
  })

  const watchedAvatarUrl = useWatch({ control, name: "avatarUrl" })
  const watchedFullName = useWatch({ control, name: "fullName" })

  // 1. HR Profile Query
  const { data: hrProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['hr-profile', session?.user.id],
    queryFn: () => getMyHrProfile(),
    enabled: !!session && session.user.role === 'HR',
  })

  React.useEffect(() => {
    if (hrProfile) {
      const nameParts = [hrProfile.firstName, hrProfile.lastName].filter(Boolean)
      reset({
        fullName: nameParts.join(" "),
        phone: hrProfile.phone || "",
        avatarUrl: hrProfile.avatarUrl || ""
      })
    }
  }, [hrProfile, reset])

  // 2. Pending Invitations Query
  const { data: invitationsData } = useQuery({
    queryKey: ['hr-invitations'],
    queryFn: () => listMyHrInvitations(),
    enabled: !!session && session.user.role === 'HR',
  })

  const pendingInvitations = invitationsData?.data || []

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const trimmed = data.fullName.trim()
      const parts = trimmed ? trimmed.split(/\s+/) : []
      const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || null
      const lastName = parts.length > 1 ? parts[parts.length - 1] : null

      return updateMyHrProfile({
        expectedVersion: hrProfile?.version,
        firstName,
        lastName,
        phone: data.phone.trim() || null,
        avatarUrl: data.avatarUrl.trim() || null,
      })
    },
    onSuccess: () => {
      setProfileSuccessNotice("Personal information updated successfully.")
      setProfileErrorNotice(null)
      queryClient.invalidateQueries({ queryKey: ['hr-profile', session?.user.id] })
    },
    onError: (error) => {
      const details = getApiErrorDetails(error)
      setProfileErrorNotice(details.message)
      setProfileSuccessNotice(null)
    }
  })

  // Accept mutation
  const acceptMutation = useMutation({
    mutationFn: (token: string) => acceptCompanyInvitation(token),
    onSuccess: (membership) => {
      setAcceptSuccess("Invitation accepted successfully! You are now a member of the company.")
      setAcceptError(null)
      setInputToken("")
      setTokenModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['hr-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['my-companies'] })
      queryClient.invalidateQueries({ queryKey: ['company-members'] })
      if (membership.companyId) {
        localStorage.setItem('hr_company_id', membership.companyId)
      }
    },
    onError: (error) => {
      const details = getApiErrorDetails(error)
      setAcceptError(details.message)
    }
  })

  const onSubmit = (data: ProfileFormValues) => {
    setProfileSuccessNotice(null)
    setProfileErrorNotice(null)
    profileMutation.mutate(data)
  }

  if (!session) return null

  return (
    <div className="space-y-8 pb-12 max-w-2xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-ink">Account Settings</h2>
          <p className="text-slate">Manage your personal HR profile and company invitations.</p>
        </div>
      </div>

      {acceptSuccess && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="text-sm font-medium">{acceptSuccess}</span>
          </div>
          <a href="/company">
            <Button size="sm" variant="outline" className="border-emerald-600/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20">
              View Company
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
      )}

      {/* Pending Invitations Section */}
      {pendingInvitations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">Pending Company Invitations</h3>
            <Dialog open={tokenModalOpen} onOpenChange={(open) => {
              setTokenModalOpen(open)
              if (!open) setAcceptError(null)
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <KeyRound className="h-4 w-4 mr-2" />
                  Enter Token to Accept
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Accept Company Invitation</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {acceptError && (
                    <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{acceptError}</span>
                    </div>
                  )}
                  <p className="text-sm text-slate">
                    Please paste the one-time invitation token from your email link.
                  </p>
                  <Input 
                    placeholder="Invitation token (e.g. 64-character token)" 
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    disabled={acceptMutation.isPending}
                  />
                  <Button 
                    className="w-full"
                    onClick={() => acceptMutation.mutate(inputToken.trim())}
                    disabled={!inputToken.trim() || acceptMutation.isPending}
                  >
                    {acceptMutation.isPending ? 'Verifying...' : 'Accept Invitation'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {pendingInvitations.map(inv => (
            <Card key={inv.id} className="border-action/20 bg-action/5">
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-action/10 rounded-full text-action shrink-0">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-ink">{inv.company.name}</h4>
                    <p className="text-sm text-slate">
                      Invited you to join as <span className="font-medium text-action">{inv.role}</span>
                    </p>
                    <p className="text-xs text-slate mt-0.5">
                      Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded border border-border">
                    <Mail className="h-3.5 w-3.5 text-action" />
                    <span>Check email to accept link</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Personal Information Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Personal Information</CardTitle>
            <CardDescription>Update your contact details and identity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {profileSuccessNotice && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{profileSuccessNotice}</span>
              </div>
            )}
            {profileErrorNotice && (
              <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{profileErrorNotice}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" value={session.user.email} disabled className="bg-slate/10" />
              <p className="text-xs text-slate">Email cannot be changed as it is used for login.</p>
            </div>

            {/* Avatar Preview & URL */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-border bg-slate/5">
              <Avatar
                size="xl"
                src={watchedAvatarUrl?.trim() || undefined}
                fallback={watchedFullName || session.user.email}
                alt="HR Avatar Preview"
                className="shrink-0 ring-2 ring-border shadow-sm bg-surface"
              />
              <div className="space-y-1.5 flex-1 w-full">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  disabled={isProfileLoading}
                  {...register("avatarUrl")}
                />
                <p className="text-xs text-slate">
                  Enter a direct image link (HTTP/HTTPS) for your profile picture.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input 
                id="fullName" 
                placeholder="e.g. Jane Doe" 
                disabled={isProfileLoading}
                {...register("fullName")} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="e.g. +84 123 456 789" 
                disabled={isProfileLoading}
                {...register("phone")} 
              />
            </div>

            <div className="space-y-2">
              <Label>Account Role</Label>
              <Input value={session.user.role === 'HR' ? 'Recruiter / HR' : session.user.role} disabled className="bg-slate/10" />
            </div>

          </CardContent>
          <CardFooter className="flex justify-end border-t border-border pt-4">
            <Button type="submit" disabled={isSubmitting || profileMutation.isPending}>
              {profileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
