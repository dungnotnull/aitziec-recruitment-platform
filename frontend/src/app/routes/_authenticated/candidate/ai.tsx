import { createFileRoute, redirect } from '@tanstack/react-router'
import { AiAnalysisWorkspace } from '@/features/ai-assistance/AiAnalysisWorkspace'

export const Route = createFileRoute('/_authenticated/candidate/ai')({
  beforeLoad: ({ context }) => {
    if (context.auth.session?.user.role !== 'CANDIDATE') throw redirect({ to: '/' })
  },
  component: AiAnalysisWorkspace,
})
