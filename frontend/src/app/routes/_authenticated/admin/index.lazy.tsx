import { createLazyFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '@/features/admin/AdminDashboard'

export const Route = createLazyFileRoute('/_authenticated/admin/')({ component: AdminDashboard })
