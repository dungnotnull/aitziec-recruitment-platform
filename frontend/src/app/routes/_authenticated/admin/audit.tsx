import { createFileRoute } from '@tanstack/react-router'
import { AuditExplorer } from '@/features/audit/AuditExplorer'
import { normalizeAuditSearch } from '@/features/audit/audit-search'

export const Route = createFileRoute('/_authenticated/admin/audit')({
  validateSearch: normalizeAuditSearch,
  component: AuditRoute,
})

function AuditRoute() {
  const filters = Route.useSearch()
  const navigate = Route.useNavigate()
  return <AuditExplorer filters={filters} onFiltersChange={(next) => void navigate({ search: next, replace: true })} />
}
