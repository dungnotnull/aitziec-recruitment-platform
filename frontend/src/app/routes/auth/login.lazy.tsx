import { createLazyFileRoute } from '@tanstack/react-router'
import { LoginForm } from '@/features/auth/components/LoginForm'

export const Route = createLazyFileRoute('/auth/login')({
  component: LoginRoute,
})

function LoginRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-surface p-8 shadow-sm border border-border">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight text-ink">
            Sign in to ITZiec
          </h2>
          <p className="mt-2 text-sm text-slate">
            Enter your email and password to access your account.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
