import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { Zap } from 'lucide-react'

export const Route = createLazyFileRoute('/auth/login')({
  component: LoginRoute,
})

function LoginRoute() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
      {/* Background ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-action/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 h-80 w-80 rounded-full bg-indigo-500/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-action to-indigo-500 shadow-xl shadow-action/30">
            <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              <span className="text-ink">IT</span>
              <span className="bg-gradient-to-r from-action to-indigo-400 bg-clip-text text-transparent">Ziec</span>
            </h1>
            <p className="mt-1 text-sm text-slate">AI-Powered Recruitment Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-surface/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/30">
          {/* Top accent */}
          <div className="absolute top-0 inset-x-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-action/30 to-transparent" />

          <div className="mb-6">
            <h2 className="text-xl font-display font-bold text-ink">Welcome back</h2>
            <p className="mt-1 text-sm text-slate">Sign in to continue to your account</p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-slate">
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-action hover:text-action-hover font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
