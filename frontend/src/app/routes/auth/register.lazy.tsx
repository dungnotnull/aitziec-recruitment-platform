import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { Zap } from 'lucide-react'

export const Route = createLazyFileRoute('/auth/register')({
  component: RegisterRoute,
})

function RegisterRoute() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-action">
            <Zap className="h-6 w-6 text-white" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              <span className="text-ink">IT</span>
              <span className="text-action">Ziec</span>
            </h1>
            <p className="mt-1 text-sm text-slate">AI-Powered Recruitment Platform</p>
          </div>
        </div>

        <section aria-labelledby="register-title" className="rounded-lg border border-border bg-surface p-8 shadow-sm">
          <div className="mb-6">
            <h2 id="register-title" className="text-xl font-display font-bold text-ink">Create your account</h2>
            <p className="mt-1 text-sm text-slate">Join ITZiec to find your next role or hire top talent</p>
          </div>

          <RegisterForm />

          <p className="mt-6 text-center text-xs text-slate">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-action hover:text-action-hover font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
