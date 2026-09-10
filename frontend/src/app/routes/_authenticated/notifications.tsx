import { createFileRoute } from '@tanstack/react-router'
import { NotificationCenter } from '@/features/notifications/NotificationCenter'

export const Route = createFileRoute('/_authenticated/notifications')({
  component: NotificationCenter,
})
