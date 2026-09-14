import { createFileRoute, Link } from '@tanstack/react-router';
import { useCompanyJobs, usePublishJob, useUnpublishJob, useDeleteJob, useApproveJob } from '@/features/job/hooks/useJobs';
import type { Job, CompanyMembership } from '@/api/types';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { JobEditor } from '@/features/job/components/JobEditor';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompany, listMembers } from '@/features/company/api';
import { StateBoundary } from '@/shared/ui/state-boundary';
import { normalizeCompanyTarget } from '@/features/company/company-context';
import { useAuth } from '@/features/auth/context';

export const Route = createFileRoute('/_authenticated/recruiter/workspace')({
  validateSearch: (search: Record<string, unknown>) => ({
    companyId: normalizeCompanyTarget(search.companyId),
  }),
  component: RecruiterWorkspacePage,
});

function RecruiterWorkspacePage() {
  const { companyId } = Route.useSearch();
  const companyQuery = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId!),
    enabled: Boolean(companyId),
    retry: false,
  });
  const company = companyQuery.data;
  const jobsQuery = useCompanyJobs(
    company?.id,
    undefined,
    { enabled: Boolean(company) },
  );
  
  const publishMutation = usePublishJob();
  const unpublishMutation = useUnpublishJob();
  const deleteMutation = useDeleteJob();
  const approveMutation = useApproveJob();
  
  const { session } = useAuth();
  
  const membersQuery = useQuery({
    queryKey: ['company-members', companyId],
    queryFn: () => listMembers(companyId!),
    enabled: Boolean(companyId),
  });
  const members = membersQuery.data?.data || [];
  const currentUserRole = members.find(m => m.user.id === session?.user.id)?.role;
  const isOwnerOrAdmin = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN' || session?.user.role === 'ADMIN';

  const handlePublish = (jobId: string, version: number) => {
    publishMutation.mutate(
      { jobId, expectedVersion: version },
      {
        onSuccess: () => alert('Job published successfully'),
        onError: (err) => alert(`Failed to publish job: ${err.message}`),
      }
    );
  };

  const handleUnpublish = (jobId: string, version: number) => {
    unpublishMutation.mutate(
      { jobId, expectedVersion: version },
      {
        onSuccess: () => alert('Job unpublished successfully'),
        onError: (err) => alert(`Failed to unpublish job: ${err.message}`),
      }
    );
  };

  const handleDelete = (jobId: string) => {
    if (confirm('Are you sure you want to delete this job?')) {
      deleteMutation.mutate(jobId, {
        onSuccess: () => showFlash('success', 'Job deleted successfully'),
        onError: (err) => showFlash('error', `Failed to delete job: ${err.message}`),
      });
    }
  };

  const handleApprove = (jobId: string, version: number) => {
    if (companyId) {
      approveMutation.mutate({ companyId, jobId, expectedVersion: version }, {
        onSuccess: () => showFlash('success', 'Job approved and published successfully'),
        onError: (err) => showFlash('error', `Failed to approve job: ${err.message}`),
      });
    }
  };

  const [isCreating, setIsCreating] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  if (isCreating && company) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <JobEditor companyId={company.id} onSuccess={() => setIsCreating(false)} />
        <Button variant="ghost" onClick={() => setIsCreating(false)} className="mt-4">Cancel</Button>
      </div>
    );
  }

  if (editingJob && company) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <h2 className="text-2xl font-bold mb-4">Edit Job</h2>
        <JobEditor companyId={company.id} initialJob={editingJob} onSuccess={() => setEditingJob(null)} />
        <Button variant="ghost" onClick={() => setEditingJob(null)} className="mt-4">Cancel</Button>
      </div>
    );
  }

  const jobs = jobsQuery.data?.data ?? [];
  const hasError = companyQuery.isError || jobsQuery.isError;
  const error = companyQuery.error ?? jobsQuery.error;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Jobs Workspace</h2>
        <Button onClick={() => setIsCreating(true)} disabled={!company}>Create New Job</Button>
      </div>

      <StateBoundary
        isLoading={(Boolean(companyId) && companyQuery.isLoading) || (Boolean(company) && jobsQuery.isLoading)}
        isError={hasError}
        error={error}
        onRetry={() => {
          if (companyId) void companyQuery.refetch();
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
                    <div className="flex flex-wrap gap-2">
                      {job.status === 'DRAFT' || job.status === 'UNPUBLISHED' ? (
                        <>
                          <Button 
                            variant="default" 
                            onClick={() => handlePublish(job.id, job.version)}
                            disabled={publishMutation.isPending}
                          >
                            Publish
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => setEditingJob(job)}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="destructive"
                            onClick={() => handleDelete(job.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                      
                      {job.status === 'PENDING_APPROVAL' && isOwnerOrAdmin ? (
                        <Button
                          variant="default"
                          onClick={() => handleApprove(job.id, job.version)}
                          disabled={approveMutation.isPending}
                        >
                          Approve Job
                        </Button>
                      ) : null}
                      
                      {job.status === 'PUBLISHED' ? (
                        <Button 
                          variant="secondary" 
                          onClick={() => handleUnpublish(job.id, job.version)}
                          disabled={unpublishMutation.isPending}
                        >
                          Unpublish
                        </Button>
                      ) : null}

                      <Button variant="outline" asChild disabled={job.status !== 'PUBLISHED'}>
                        {job.status === 'PUBLISHED' ? (
                          <Link to="/jobs/$jobIdOrSlug" params={{ jobIdOrSlug: job.slug }}>View Public</Link>
                        ) : (
                          <span>View Public</span>
                        )}
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
