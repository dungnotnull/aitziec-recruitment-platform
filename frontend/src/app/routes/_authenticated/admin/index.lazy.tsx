import { createLazyFileRoute } from '@tanstack/react-router'
import { UserAdministration } from '@/features/admin/UserAdministration'

export const Route = createLazyFileRoute('/_authenticated/admin/')({ component: UserAdministration })
