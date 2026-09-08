import { createLazyFileRoute } from '@tanstack/react-router'
import { ProfileOverview } from '@/features/candidate/components/ProfileOverview'

export const Route = createLazyFileRoute('/_authenticated/profile')({
  component: ProfileRoute,
})

function ProfileRoute() {
  return <ProfileOverview />
}
