import React, { useEffect, useState } from 'react';
import { useSaveJob, useUnsaveJob, useIsJobSaved } from '../hooks/useSavedJobs';
import { Button } from '@/shared/ui/button';
import { Link } from '@tanstack/react-router';
import { Bookmark, BookmarkCheck } from 'lucide-react';

interface SavedJobButtonProps {
  jobId: string;
  initialIsSaved?: boolean;
}

export const SavedJobButton: React.FC<SavedJobButtonProps> = ({ jobId, initialIsSaved = false }) => {
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  
  const { data: savedStatus, isLoading } = useIsJobSaved(jobId);
  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();

  useEffect(() => {
    if (savedStatus?.isSaved !== undefined) {
      setIsSaved(savedStatus.isSaved);
    }
  }, [savedStatus?.isSaved]);

  const handleToggle = () => {
    setIsSaved(!isSaved);

    if (isSaved) {
      unsaveJob.mutate(jobId, {
        onError: () => setIsSaved(true),
      });
    } else {
      saveJob.mutate(jobId, {
        onError: () => setIsSaved(false),
      });
    }
  };

  if (isLoading && !initialIsSaved) {
    return (
      <Button variant="outline" disabled className="w-full opacity-70">
        <Bookmark className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={isSaved ? "secondary" : "outline"}
        onClick={handleToggle}
        disabled={saveJob.isPending || unsaveJob.isPending}
        aria-label={isSaved ? "Unsave job" : "Save job"}
        className={`w-full transition-all ${isSaved ? 'bg-action/10 hover:bg-action/20 text-action border-transparent' : ''}`}
      >
        {isSaved ? <BookmarkCheck className="mr-2 h-4 w-4 text-action" /> : <Bookmark className="mr-2 h-4 w-4" />}
        {isSaved ? "Saved" : "Save for later"}
      </Button>
      {isSaved && (
        <p className="text-xs text-muted-foreground text-center animate-in fade-in zoom-in">
          Job saved! <Link to="/candidate/saved-jobs" className="text-action font-medium hover:underline ml-1">View all</Link>
        </p>
      )}
    </div>
  );
};
