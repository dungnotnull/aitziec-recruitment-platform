import { createLazyFileRoute } from '@tanstack/react-router'
import { ProfileOverview } from '@/features/candidate/components/ProfileOverview'
import { AccountSettingsOverview } from '@/features/auth/components/AccountSettingsOverview'
import { useAuth } from '@/features/auth/context'

export const Route = createLazyFileRoute('/_authenticated/profile')({
  component: ProfileRoute,
})

function ProfileRoute() {
  const { session } = useAuth()

  if (!session) return null

  if (session.user.role === 'CANDIDATE') {
    return <ProfileOverview />
  }

  return <AccountSettingsOverview />
}
