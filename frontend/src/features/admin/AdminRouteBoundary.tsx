import { Outlet } from '@tanstack/react-router'
import { ShieldX } from 'lucide-react'
import { useAuth } from '@/features/auth/context'

export function AdminRouteBoundary() {
  const { session } = useAuth()
  if (session?.user.role !== 'ADMIN') return <section className="mx-auto max-w-xl rounded-xl border border-danger/30 bg-surface p-8 text-center"><ShieldX className="mx-auto h-9 w-9 text-danger" aria-hidden="true" /><h1 className="mt-4 font-display text-2xl font-bold text-ink">Administrator access required</h1><p className="mt-2 text-ink-muted">This workspace is available only to administrator accounts. The server still verifies every request.</p></section>
  return <Outlet />
}
