import React from 'react';
import { useSaveJob, useUnsaveJob } from '../hooks/useSavedJobs';
import { Button } from '@/shared/ui/button';

interface SavedJobButtonProps {
  jobId: string;
  initialIsSaved?: boolean;
}

export const SavedJobButton: React.FC<SavedJobButtonProps> = ({ jobId, initialIsSaved = false }) => {
  const [isSaved, setIsSaved] = React.useState(initialIsSaved);
  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();

  const handleToggle = () => {
    // Optimistic update
    setIsSaved(!isSaved);

    if (isSaved) {
      unsaveJob.mutate(jobId, {
        onError: () => setIsSaved(true), // Rollback
      });
    } else {
      saveJob.mutate(jobId, {
        onError: () => setIsSaved(false), // Rollback
      });
    }
  };

  return (
    <Button
      variant={isSaved ? "default" : "outline"}
      onClick={handleToggle}
      aria-label={isSaved ? "Unsave job" : "Save job"}
    >
      {isSaved ? "Saved" : "Save"}
    </Button>
  );
};
