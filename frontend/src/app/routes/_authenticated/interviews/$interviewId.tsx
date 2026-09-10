import { createFileRoute, Link } from '@tanstack/react-router'
import { useInterview } from '@/features/interview/hooks/useInterview'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { formatUtcDateTime } from '@/shared/lib/date-time'

export const Route = createFileRoute('/_authenticated/interviews/$interviewId')({
  component: InterviewDetailPage,
})

function InterviewDetailPage() {
  const { interviewId } = Route.useParams()
  const query = useInterview(interviewId)

  if (query.isPending) return <p role="status">Loading interview…</p>
  if (query.isError) return <Alert variant="destructive"><AlertTitle>Interview unavailable</AlertTitle><AlertDescription>{query.error.message}</AlertDescription></Alert>

  const interview = query.data.data
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="text-sm font-semibold text-action hover:underline">Back to dashboard</Link>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>Interview details</CardTitle>
          <Badge>{interview.status}</Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <dt className="font-semibold">Starts</dt><dd>{formatUtcDateTime(interview.startsAt)}</dd>
            <dt className="font-semibold">Ends</dt><dd>{formatUtcDateTime(interview.endsAt)}</dd>
            <dt className="font-semibold">Location or link</dt><dd className="break-words">{interview.locationOrMeetingUrl}</dd>
            {interview.candidateInstructions ? <><dt className="font-semibold">Instructions</dt><dd className="whitespace-pre-wrap">{interview.candidateInstructions}</dd></> : null}
            {interview.recruiterPrivateNotes ? <><dt className="font-semibold">Private notes</dt><dd className="whitespace-pre-wrap">{interview.recruiterPrivateNotes}</dd></> : null}
            {interview.recruiterFeedback ? <><dt className="font-semibold">Feedback</dt><dd className="whitespace-pre-wrap">{interview.recruiterFeedback}</dd></> : null}
          </dl>
        </CardContent>
      </Card>
    </section>
  )
}
