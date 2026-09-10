import React from 'react';
import { useInterviews, useCompleteInterview, useCancelInterview } from '../hooks/useInterview';
import { Card, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import type { Interview } from '@/api/types';

interface InterviewListProps {
  applicationId: string;
  isRecruiter?: boolean;
  onEdit?: (interview: Interview) => void;
}

export const InterviewList: React.FC<InterviewListProps> = ({ applicationId, isRecruiter = false, onEdit }) => {
  const { data, isLoading, isError, error } = useInterviews(applicationId);
  const completeInterview = useCompleteInterview();
  const cancelInterview = useCancelInterview();

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-24 bg-muted rounded"></div></div>;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error?.message || 'Failed to load interviews.'}</AlertDescription>
      </Alert>
    );
  }

  const interviews = data?.data || [];

  if (interviews.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
        No interviews scheduled.
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'default';
      case 'COMPLETED': return 'secondary';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  const handleComplete = (interview: Interview) => {
    const feedback = window.prompt('Enter optional feedback for completion (Recruiter only):', '');
    if (feedback !== null) {
      completeInterview.mutate({
        interviewId: interview.id,
        expectedVersion: interview.version,
        recruiterFeedback: feedback || undefined,
      });
    }
  };

  const handleCancel = (interview: Interview) => {
    const reason = window.prompt('Enter required reason for cancellation:', '');
    if (reason) {
      cancelInterview.mutate({
        interviewId: interview.id,
        expectedVersion: interview.version,
        reason,
      });
    } else if (reason !== null) {
      alert('A reason is required to cancel an interview.');
    }
  };

  return (
    <div className="space-y-4">
      {interviews.map((interview) => (
        <Card key={interview.id} className={interview.status === 'CANCELLED' ? 'opacity-70' : ''}>
          <CardContent className="p-4 flex flex-col md:flex-row justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-lg">
                  {new Date(interview.startsAt).toLocaleString()} - {new Date(interview.endsAt).toLocaleTimeString()}
                </h4>
                <Badge variant={getStatusColor(interview.status)}>{interview.status}</Badge>
              </div>

              <div className="text-sm">
                <span className="font-medium">Location/Link:</span>{' '}
                {interview.locationOrMeetingUrl.startsWith('http') ? (
                  <a href={interview.locationOrMeetingUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                    {interview.locationOrMeetingUrl}
                  </a>
                ) : (
                  <span>{interview.locationOrMeetingUrl}</span>
                )}
              </div>

              {interview.candidateInstructions && (
                <div className="text-sm bg-muted p-2 rounded mt-2">
                  <span className="font-medium block mb-1">Instructions:</span>
                  <span className="whitespace-pre-wrap">{interview.candidateInstructions}</span>
                </div>
              )}

              {isRecruiter && interview.recruiterPrivateNotes && (
                <div className="text-sm bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 p-2 rounded mt-2 border border-amber-200 dark:border-amber-800">
                  <span className="font-medium block mb-1">Private Notes:</span>
                  <span className="whitespace-pre-wrap">{interview.recruiterPrivateNotes}</span>
                </div>
              )}

              {isRecruiter && interview.recruiterFeedback && (
                <div className="text-sm bg-muted p-2 rounded mt-2">
                  <span className="font-medium block mb-1">Feedback:</span>
                  <span className="whitespace-pre-wrap">{interview.recruiterFeedback}</span>
                </div>
              )}
            </div>

            {isRecruiter && interview.status === 'SCHEDULED' && (
              <div className="flex flex-col gap-2 min-w-[120px]">
                {onEdit && (
                  <Button size="sm" variant="outline" onClick={() => onEdit(interview)}>
                    Edit/Reschedule
                  </Button>
                )}
                <Button size="sm" onClick={() => handleComplete(interview)} disabled={completeInterview.isPending}>
                  Mark Completed
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleCancel(interview)} disabled={cancelInterview.isPending}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
