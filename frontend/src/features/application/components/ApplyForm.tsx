import React, { useState } from 'react';
import { useSubmitApplication } from '../hooks/useApplication';
import { useCvs } from '@/features/cv/hooks/useCv';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Alert, AlertDescription } from '@/shared/ui/alert';

interface ApplyFormProps {
  jobId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ApplyForm: React.FC<ApplyFormProps> = ({ jobId, onSuccess, onCancel }) => {
  const [selectedCvId, setSelectedCvId] = useState<string>('');
  const [candidateNote, setCandidateNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const submitApplication = useSubmitApplication();
  const { data: cvsData, isLoading: isLoadingCvs } = useCvs();
  const cvs = cvsData?.data || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCvId) {
      setError('Please select a CV to apply with.');
      return;
    }
    setError(null);

    submitApplication.mutate(
      {
        jobId,
        data: { cvId: selectedCvId, candidateNote: candidateNote || null },
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess,
        onError: (err: any) => {
          setError(err.response?.data?.error?.message || 'Failed to submit application.');
        }
      }
    );
  };

  if (isLoadingCvs) {
    return <div className="p-4 animate-pulse bg-muted rounded h-32" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4 bg-card p-6 rounded-lg border">
        <h3 className="text-lg font-semibold">Submit Application</h3>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="cvSelect">Select CV *</Label>
          {cvs.length === 0 ? (
            <div className="text-sm text-destructive p-3 bg-destructive/10 rounded">
              You don't have any ready CVs. Please upload a CV in your profile first.
            </div>
          ) : (
            <select
              id="cvSelect"
              value={selectedCvId}
              onChange={(e) => setSelectedCvId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              required
            >
              <option value="" disabled>Select a CV...</option>
              {cvs.filter(cv => cv.processingStatus === 'READY').map(cv => (
                <option key={cv.id} value={cv.id}>
                  {cv.originalFileName} {cv.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="candidateNote">Message to Recruiter (Optional)</Label>
          <textarea
            id="candidateNote"
            value={candidateNote}
            onChange={(e) => setCandidateNote(e.target.value)}
            placeholder="Introduce yourself or highlight specific experiences..."
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          />
        </div>

        <div className="text-xs text-muted-foreground">
          By submitting this application, you agree to share your profile information and selected CV with the employer.
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitApplication.isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitApplication.isPending || cvs.length === 0}>
          {submitApplication.isPending ? 'Submitting...' : 'Submit Application'}
        </Button>
      </div>
    </form>
  );
};
