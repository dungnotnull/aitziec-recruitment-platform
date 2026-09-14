import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listMembers, addMember, removeMember } from "../api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table"
import { Badge } from "@/shared/ui/badge"
import { StateBoundary } from "@/shared/ui/state-boundary"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog"
import { Plus, UserMinus, XCircle, MailWarning } from "lucide-react"
import { useAuth } from "@/features/auth/context"

export function MemberDirectory({ companyId }: { companyId: string }) {
  const { session } = useAuth()
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState("")
  const [newRole, setNewRole] = React.useState<"RECRUITER">("RECRUITER")
  
  // Mock State for Pending Invites
  const [mockPending, setMockPending] = React.useState([
    { id: 'inv-1', email: 'alice.candidate@example.com', role: 'RECRUITER', sentAt: new Date(Date.now() - 86400000).toLocaleDateString() }
  ])

  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['company-members', companyId],
    queryFn: () => listMembers(companyId),
    enabled: !!companyId,
  })

  const members = data?.data || []
  
  const currentUserRole = members.find(m => m.user.id === session?.user.id)?.role;
  const isOwner = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN' || session?.user.role === 'ADMIN';

  // We mock the addMutation to push to the local state to demonstrate the flow without backend auto-adding
  const addMutation = useMutation({
    mutationFn: async () => {
      // Simulate network request
      await new Promise(r => setTimeout(r, 500))
      return { email: newEmail, role: newRole }
    },
    onSuccess: (data) => {
      setMockPending(prev => [...prev, {
        id: `inv-${Date.now()}`,
        email: data.email,
        role: data.role,
        sentAt: new Date().toLocaleDateString()
      }])
      setIsAddOpen(false)
      setNewEmail("")
      alert(`[Mock UI] Lời mời đã được đưa vào danh sách Pending cho ${data.email}.`)
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Directory</CardTitle>
            <CardDescription className="mt-1">Active members in your organization.</CardDescription>
          </div>
          {isOwner && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
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
                  <div className="space-y-2">
                    <Input 
                      placeholder="Email address" 
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => addMutation.mutate()}
                    disabled={!newEmail || addMutation.isPending}
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
                          onClick={() => {
                            if (confirm('Are you sure you want to remove this member?')) {
                              removeMutation.mutate(member.id)
                            }
                          }}
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

      {/* Mock Pending Invitations Section */}
      {isOwner && mockPending.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MailWarning className="h-5 w-5 text-warning" />
              <CardTitle className="text-lg">Pending Invitations (Mock UI)</CardTitle>
            </div>
            <CardDescription>
              These users have been invited but have not accepted yet. 
              (This is a UI mock to demonstrate the 2-step flow)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPending.map(invite => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-warning text-warning">
                        {invite.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate">{invite.sentAt}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-danger hover:text-danger hover:bg-danger/10"
                        onClick={() => {
                          if (confirm('Revoke this invitation?')) {
                            setMockPending(prev => prev.filter(p => p.id !== invite.id))
                          }
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
