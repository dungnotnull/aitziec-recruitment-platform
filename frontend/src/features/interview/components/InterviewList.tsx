import React, { useState } from 'react';
import { useInterviews, useCompleteInterview, useCancelInterview } from '../hooks/useInterview';
import { Card, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Loader2 } from 'lucide-react';
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

  const [completingInterview, setCompletingInterview] = useState<Interview | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  const [cancellingInterview, setCancellingInterview] = useState<Interview | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);

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

  const openCompleteModal = (interview: Interview) => {
    setCompletingInterview(interview);
    setFeedbackText(interview.recruiterFeedback || '');
  };

  const submitComplete = () => {
    if (!completingInterview) return;
    completeInterview.mutate(
      {
        interviewId: completingInterview.id,
        expectedVersion: completingInterview.version,
        recruiterFeedback: feedbackText.trim() || undefined,
      },
      {
        onSuccess: () => setCompletingInterview(null),
      }
    );
  };

  const openCancelModal = (interview: Interview) => {
    setCancellingInterview(interview);
    setCancelReasonText('');
    setCancelReasonError(null);
  };

  const submitCancel = () => {
    if (!cancellingInterview) return;
    if (!cancelReasonText.trim()) {
      setCancelReasonError('A reason is required to cancel an interview.');
      return;
    }
    cancelInterview.mutate(
      {
        interviewId: cancellingInterview.id,
        expectedVersion: cancellingInterview.version,
        reason: cancelReasonText.trim(),
      },
      {
        onSuccess: () => setCancellingInterview(null),
      }
    );
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
                <Button size="sm" onClick={() => openCompleteModal(interview)} disabled={completeInterview.isPending}>
                  Mark Completed
                </Button>
                <Button size="sm" variant="destructive" onClick={() => openCancelModal(interview)} disabled={cancelInterview.isPending}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Complete Interview Dialog */}
      <Dialog open={!!completingInterview} onOpenChange={(open) => !open && setCompletingInterview(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Complete Interview</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Add optional feedback for the candidate or hiring team before marking this interview as completed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="recruiterFeedback" className="text-sm font-semibold">
              Feedback (Optional)
            </Label>
            <textarea
              id="recruiterFeedback"
              rows={4}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Enter assessment, candidate performance, next steps..."
              className="w-full rounded-xl border border-input bg-background p-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-action"
            />
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompletingInterview(null)}
              disabled={completeInterview.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitComplete}
              disabled={completeInterview.isPending}
              className="min-w-[120px]"
            >
              {completeInterview.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Mark Completed'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Interview Dialog */}
      <Dialog open={!!cancellingInterview} onOpenChange={(open) => !open && setCancellingInterview(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive">Cancel Interview</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Please enter the reason for cancelling this interview. The candidate will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="cancellationReason" className="text-sm font-semibold">
              Cancellation Reason *
            </Label>
            <textarea
              id="cancellationReason"
              rows={3}
              value={cancelReasonText}
              onChange={(e) => {
                setCancelReasonText(e.target.value);
                if (cancelReasonError) setCancelReasonError(null);
              }}
              placeholder="e.g. Candidate withdrew, Position filled, Emergency schedule conflict..."
              className="w-full rounded-xl border border-input bg-background p-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive"
              required
            />
            {cancelReasonError && (
              <p className="text-xs font-semibold text-destructive">{cancelReasonError}</p>
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancellingInterview(null)}
              disabled={cancelInterview.isPending}
            >
              Keep Interview
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submitCancel}
              disabled={cancelInterview.isPending}
              className="min-w-[120px]"
            >
              {cancelInterview.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Interview'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
