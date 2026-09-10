import React from 'react';
import { useSavedJobs } from '../hooks/useSavedJobs';
import { JobCard } from '@/features/job/components/JobCard';
import { Alert, AlertTitle, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';

export const SavedJobsList: React.FC = () => {
  const { data, isLoading, isError, error, refetch } = useSavedJobs();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading saved jobs</AlertTitle>
        <AlertDescription>
          {error?.message || 'An unexpected error occurred.'}
        </AlertDescription>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          Try Again
        </Button>
      </Alert>
    );
  }

  const jobs = data?.data || [];

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg border-dashed">
        <h3 className="text-lg font-medium">No saved jobs</h3>
        <p className="text-muted-foreground mt-2">
          You haven't saved any jobs yet. Browse jobs and save them for later!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Saved Jobs</h2>
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
};
