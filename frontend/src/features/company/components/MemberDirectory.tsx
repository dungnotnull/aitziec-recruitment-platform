import * as React from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table"
import { Badge } from "@/shared/ui/badge"
import { StateBoundary } from "@/shared/ui/state-boundary"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog"
import { Plus, UserMinus } from "lucide-react"

// Mock API
const fetchMembers = async () => {
  return [
    { id: "1", email: "admin@acme.com", role: "OWNER", joinedAt: "2023-01-15" },
    { id: "2", email: "hr1@acme.com", role: "ADMIN", joinedAt: "2023-03-20" },
    { id: "3", email: "recruiter@acme.com", role: "MEMBER", joinedAt: "2023-06-10" },
  ]
}

export function MemberDirectory() {
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState("")
  const [newRole, setNewRole] = React.useState("MEMBER")

  const { data: members, isLoading, isError, refetch } = useQuery({
    queryKey: ['company-members'],
    queryFn: fetchMembers
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      // Mock add
      console.log("Inviting", newEmail, "as", newRole)
      setIsAddOpen(false)
      setNewEmail("")
    }
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      // Mock remove
      console.log("Removing member", id)
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
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="colleague@acme.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Standard Member</option>
                </select>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !newEmail}>
                  Send Invitation
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
              {members?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'OWNER' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate">{member.joinedAt}</TableCell>
                  <TableCell className="text-right">
                    {member.role !== 'OWNER' && (
                      <Button variant="ghost" size="icon" className="text-danger hover:bg-danger/10 p-1" onClick={() => removeMutation.mutate(member.id)}>
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
