import { createLazyFileRoute } from '@tanstack/react-router'
import { CompanyDashboard } from '@/features/company/components/CompanyDashboard'

export const Route = createLazyFileRoute('/_authenticated/company/')({
  component: CompanyDashboardRoute,
})

function CompanyDashboardRoute() {
  return <CompanyDashboard />
}
