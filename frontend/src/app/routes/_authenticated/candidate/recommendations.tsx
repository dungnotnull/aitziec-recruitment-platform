import { createFileRoute, redirect } from '@tanstack/react-router'
import { Recommendations } from '@/features/ai-assistance/Recommendations'

export const Route = createFileRoute('/_authenticated/candidate/recommendations')({
  beforeLoad: ({ context }) => {
    if (context.auth.session?.user.role !== 'CANDIDATE') throw redirect({ to: '/' })
  },
  component: Recommendations,
})
