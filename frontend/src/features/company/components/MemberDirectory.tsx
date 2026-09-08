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

export function MemberDirectory({ companyId }: { companyId: string }) {
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
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email address</label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="colleague@acme.com" disabled={addMutation.isPending} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "RECRUITER")}
                  disabled={addMutation.isPending}
                >
                  <option value="RECRUITER">Recruiter</option>
                </select>
                <p className="text-xs text-slate mt-1">Backend only supports adding RECRUITER directly.</p>
              </div>
              {addMutation.isError && (
                <p className="text-sm text-danger">Failed to invite member. Please check if email exists and is not already a member.</p>
              )}
              <div className="flex justify-end pt-4">
                <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newEmail}>
                  {addMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
                    {member.role !== 'OWNER' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-danger hover:bg-danger/10 p-1" 
                        onClick={() => removeMutation.mutate(member.id)}
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
