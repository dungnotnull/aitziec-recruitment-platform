import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listMembers, addMember, removeMember } from "../api"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table"
import { Badge } from "@/shared/ui/badge"
import { StateBoundary } from "@/shared/ui/state-boundary"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog"
import { Plus, UserMinus } from "lucide-react"
import { useAuth } from "@/features/auth/context"

export function MemberDirectory({ companyId }: { companyId: string }) {
  const { session } = useAuth()
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState("")
  const [newRole, setNewRole] = React.useState<"RECRUITER">("RECRUITER")
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['company-members', companyId],
    queryFn: () => listMembers(companyId),
    enabled: !!companyId,
  })

  const members = data?.data || []
  
  const currentUserRole = members.find(m => m.user.id === session?.user.id)?.role;
  const isOwner = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN' || session?.user.role === 'ADMIN';

  const addMutation = useMutation({
    mutationFn: () => {
      return addMember(companyId, {
        userEmail: newEmail,
        role: newRole,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-members', companyId] })
      setIsAddOpen(false)
      setNewEmail("")
    }
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeMember(companyId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-members', companyId] })
    }
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Directory</CardTitle>
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
  )
}
