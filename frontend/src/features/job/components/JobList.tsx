import React from 'react';
import { JobCard } from './JobCard';
import type { JobSearchFilters } from '@/api/types';
import { useJobs } from '../hooks/useJobs';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';

interface JobListProps {
  filters?: JobSearchFilters;
}

export const JobList: React.FC<JobListProps> = ({ filters }) => {
  const { data, isLoading, isError, error, refetch } = useJobs(filters);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading jobs</AlertTitle>
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
        <h3 className="text-lg font-medium">No jobs found</h3>
        <p className="text-muted-foreground mt-2">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}

      {data?.meta?.page?.hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}
    </div>
  );
};
