import { UserAdministration } from './UserAdministration'
import { ModerationWorkspace } from './ModerationWorkspace'

export function AdminDashboard() {
  return <div className="space-y-10"><UserAdministration /><ModerationWorkspace /></div>
}
