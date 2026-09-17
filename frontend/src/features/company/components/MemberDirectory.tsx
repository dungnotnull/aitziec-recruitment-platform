import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listMembers, addMember, removeMember } from "../api"
import type { CompanyInvitation, CompanyMembership } from "@/api/types"
import { getApiErrorDetails } from "@/shared/lib/api-error"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table"
import { Badge } from "@/shared/ui/badge"
import { StateBoundary } from "@/shared/ui/state-boundary"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog"
import { ConfirmDialog } from "@/shared/ui/confirm-dialog"
import { Plus, UserMinus, MailCheck, AlertCircle } from "lucide-react"
import { useAuth } from "@/features/auth/context"

export function MemberDirectory({ companyId }: { companyId: string }) {
  const { session } = useAuth()
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [successNotice, setSuccessNotice] = React.useState<string | null>(null)
  const [removingMember, setRemovingMember] = React.useState<CompanyMembership | null>(null)
  
  // Pending invitations created during this session
  const [pendingInvites, setPendingInvites] = React.useState<CompanyInvitation[]>([])

  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['company-members', companyId],
    queryFn: () => listMembers(companyId),
    enabled: !!companyId,
  })

  const members = data?.data || []
  
  const currentUserRole = members.find(m => m.user.id === session?.user.id)?.role;
  const isOwner = currentUserRole === 'OWNER' || session?.user.role === 'ADMIN';

  const addMutation = useMutation({
    mutationFn: (email: string) => addMember(companyId, { userEmail: email, role: 'RECRUITER' }),
    onSuccess: (invitation) => {
      setPendingInvites(prev => [invitation, ...prev.filter(p => p.id !== invitation.id)])
      setIsAddOpen(false)
      setNewEmail("")
      setErrorMessage(null)
      setSuccessNotice(`Invitation sent to ${newEmail}! An invitation email has been sent to the recruiter.`)
      queryClient.invalidateQueries({ queryKey: ['company-members', companyId] })
    },
    onError: (error) => {
      const details = getApiErrorDetails(error)
      setErrorMessage(details.message)
    }
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeMember(companyId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-members', companyId] })
    }
  })

  return (
    <div className="space-y-6">
      {successNotice && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
          <MailCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm font-medium">{successNotice}</p>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Directory</CardTitle>
            <CardDescription className="mt-1">Active members in your organization.</CardDescription>
          </div>
          {isOwner && (
            <Dialog open={isAddOpen} onOpenChange={(open) => {
              setIsAddOpen(open)
              if (!open) {
                setErrorMessage(null)
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite new member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {errorMessage && (
                    <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Input 
                      placeholder="Recruiter email address (e.g. hr@domain.com)" 
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={addMutation.isPending}
                    />
                    <p className="text-xs text-slate">
                      The invited user must have an active HR account. An invitation link will be emailed to them.
                    </p>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => addMutation.mutate(newEmail.trim())}
                    disabled={!newEmail.trim() || addMutation.isPending}
                  >
                    {addMutation.isPending ? 'Sending...' : 'Send Invite'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <StateBoundary isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate py-4">No members found.</TableCell>
                  </TableRow>
                )}
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.user.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'OWNER' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate">{new Date(member.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {isOwner && member.role !== 'OWNER' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-danger hover:text-danger hover:bg-danger/10"
                          onClick={() => setRemovingMember(member)}
                          disabled={removeMutation.isPending}
                        >
                          <UserMinus className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </StateBoundary>
        </CardContent>
      </Card>

      {/* Pending Invitations Section */}
      {isOwner && pendingInvites.length > 0 && (
        <Card className="border-action/30 bg-action/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MailCheck className="h-5 w-5 text-action" />
              <CardTitle className="text-lg">Pending Invitations</CardTitle>
            </div>
            <CardDescription>
              These recruiters have been sent an invitation email. Once they accept via their email link, they will appear in the active member directory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map(invite => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-action text-action">
                        {invite.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {invite.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title="Remove Member"
        description={
          removingMember
            ? `Are you sure you want to remove ${removingMember.user.email} from this company?`
            : 'Are you sure you want to remove this member?'
        }
        confirmText="Remove Member"
        variant="destructive"
        isLoading={removeMutation.isPending}
        onConfirm={() => {
          if (removingMember) {
            removeMutation.mutate(removingMember.id, {
              onSuccess: () => setRemovingMember(null),
            });
          }
        }}
      />
    </div>
  )
}
