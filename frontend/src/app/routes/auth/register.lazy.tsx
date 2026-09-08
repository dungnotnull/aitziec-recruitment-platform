import { createLazyFileRoute } from '@tanstack/react-router'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export const Route = createLazyFileRoute('/auth/register')({
  component: RegisterRoute,
})

function RegisterRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-surface p-8 shadow-sm border border-border">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight text-ink">
            Create an account
          </h2>
          <p className="mt-2 text-sm text-slate">
            Join ITZiec to find your next role or hire top talent.
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}
