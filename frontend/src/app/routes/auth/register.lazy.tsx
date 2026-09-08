import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { Zap } from 'lucide-react'

export const Route = createLazyFileRoute('/auth/register')({
  component: RegisterRoute,
})

function RegisterRoute() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
      {/* Background ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-action/5 blur-[100px]" />
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
        <div className="relative rounded-2xl border border-border/60 bg-surface/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/30">
          {/* Top accent */}
          <div className="absolute top-0 inset-x-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />

          <div className="mb-6">
            <h2 className="text-xl font-display font-bold text-ink">Create your account</h2>
            <p className="mt-1 text-sm text-slate">Join ITZiec to find your next role or hire top talent</p>
          </div>

          <RegisterForm />

          <p className="mt-6 text-center text-xs text-slate">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-action hover:text-action-hover font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
