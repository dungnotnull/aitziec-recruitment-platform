import { createFileRoute, Link } from '@tanstack/react-router';
import { useJobs } from '@/features/job/hooks/useJobs';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { JobEditor } from '@/features/job/components/JobEditor';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyCompanies } from '@/features/company/api';
import { StateBoundary } from '@/shared/ui/state-boundary';

export const Route = createFileRoute('/_authenticated/recruiter/workspace')({
  component: RecruiterWorkspacePage,
});

function RecruiterWorkspacePage() {
  const companiesQuery = useQuery({
    queryKey: ['my-companies'],
    queryFn: getMyCompanies,
    retry: false,
  });
  const company = companiesQuery.data?.[0];
  const jobsQuery = useJobs(
    company ? { companyId: company.id } : undefined,
    { enabled: Boolean(company) },
  );
  const [isCreating, setIsCreating] = useState(false);

  if (isCreating && company) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <JobEditor companyId={company.id} onSuccess={() => setIsCreating(false)} />
      </div>
    );
  }

  const jobs = jobsQuery.data?.data ?? [];
  const hasError = companiesQuery.isError || jobsQuery.isError;
  const error = companiesQuery.error ?? jobsQuery.error;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Jobs Workspace</h2>
        <Button onClick={() => setIsCreating(true)} disabled={!company}>Create New Job</Button>
      </div>

      <StateBoundary
        isLoading={companiesQuery.isLoading || (Boolean(company) && jobsQuery.isLoading)}
        isError={hasError}
        error={error}
        onRetry={() => {
          void companiesQuery.refetch();
          if (company) void jobsQuery.refetch();
        }}
      >
        {!company ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium text-ink">No company is available for this account.</p>
            <p className="mt-2 text-sm text-slate">Create or join a company before publishing jobs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {jobs.length === 0 ? (
              <div className="text-center py-12 border rounded-lg border-dashed">
                <p className="text-muted-foreground">You haven't posted any jobs yet.</p>
              </div>
            ) : (
              jobs.map(job => (
                <Card key={job.id}>
                  <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                      <h3 className="font-semibold text-lg">{job.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={job.status === 'PUBLISHED' ? 'default' : 'secondary'}>{job.status}</Badge>
                        <span className="text-sm text-muted-foreground">{job.location}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" asChild>
                        <Link to="/jobs/$jobIdOrSlug" params={{ jobIdOrSlug: job.slug }}>View Public</Link>
                      </Button>
                      <Button asChild>
                        <Link to="/recruiter/jobs/$jobId/applicants" params={{ jobId: job.id }}>Manage Applicants</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </StateBoundary>
    </div>
  );
}
