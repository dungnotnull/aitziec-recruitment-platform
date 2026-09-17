import { createFileRoute, Link } from '@tanstack/react-router';
import { useCompanyJobs, usePublishJob, useUnpublishJob, useCloseJob, useApproveJob } from '@/features/job/hooks/useJobs';
import type { Job } from '@/api/types';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { JobEditor } from '@/features/job/components/JobEditor';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompany, listMyCompanies } from '@/features/company/api';
import { StateBoundary } from '@/shared/ui/state-boundary';
import { normalizeCompanyTarget } from '@/features/company/company-context';
import { useAuth } from '@/features/auth/context';
import { useRouter } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle, AlertCircle, X, User } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/recruiter/workspace')({
  validateSearch: (search: Record<string, unknown>) => ({
    companyId: normalizeCompanyTarget(search.companyId),
  }),
  component: RecruiterWorkspacePage,
});

function RecruiterWorkspacePage() {
  const searchCompanyId = Route.useSearch().companyId;
  const router = useRouter();

  const myCompaniesQuery = useQuery({
    queryKey: ['my-companies'],
    queryFn: () => listMyCompanies(),
  });
  const companyId = searchCompanyId || myCompaniesQuery.data?.[0]?.company.id;
  
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
  const closeMutation = useCloseJob();
  const approveMutation = useApproveJob();
  
  const { session } = useAuth();
  
  const currentUserRole = myCompaniesQuery.data?.find(c => c.company.id === companyId)?.membership.role;
  const isOwnerOrAdmin = currentUserRole === 'OWNER' || (currentUserRole as string) === 'ADMIN' || session?.user.role === 'ADMIN';

  const [flash, setFlash] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = (type: 'success' | 'error', message: string) => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    setFlash({ type, message });
    flashTimerRef.current = setTimeout(() => {
      setFlash(null);
      flashTimerRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  const handlePublish = (jobId: string, version: number) => {
    publishMutation.mutate(
      { jobId, expectedVersion: version },
      {
        onSuccess: (res) => {
          const isPendingApproval =
            res?.data?.status === 'PENDING_APPROVAL' ||
            (!isOwnerOrAdmin && res?.data?.status !== 'PUBLISHED');
          if (isPendingApproval) {
            showFlash('success', 'Job publication request submitted successfully');
          } else {
            showFlash('success', 'Job published successfully');
          }
        },
        onError: (err) => showFlash('error', `Failed to publish job: ${err.message}`),
      }
    );
  };

  const handleUnpublish = (jobId: string, version: number) => {
    unpublishMutation.mutate(
      { jobId, expectedVersion: version },
      {
        onSuccess: () => showFlash('success', 'Job unpublished successfully'),
        onError: (err) => showFlash('error', `Failed to unpublish job: ${err.message}`),
      }
    );
  };

  const [closingJob, setClosingJob] = useState<{ id: string; version: number } | null>(null);

  const handleClose = (jobId: string, version: number) => {
    setClosingJob({ id: jobId, version });
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
      <div className="mb-4">
        <Button variant="ghost" onClick={() => router.navigate({ to: '/company', search: { companyId } })} className="text-muted-foreground hover:text-foreground -ml-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Company
        </Button>
      </div>

      {flash && (
        <div
          role="alert"
          className={`p-4 rounded-lg flex items-center justify-between transition-all ${
            flash.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {flash.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{flash.message}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (flashTimerRef.current) {
                clearTimeout(flashTimerRef.current);
                flashTimerRef.current = null;
              }
              setFlash(null);
            }}
            className="text-slate-500 hover:text-slate-800 ml-4"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
              jobs.map(job => {
                const isCreatedByCurrentUser = Boolean(session?.user.id && job.creatorId === session.user.id);
                const creatorDisplayName = job.creatorName || (isCreatedByCurrentUser ? 'Bạn' : null);
                const creatorDisplayEmail = job.creatorEmail || (isCreatedByCurrentUser ? session?.user.email : null);

                return (
                  <Card key={job.id}>
                    <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-lg">{job.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant={job.status === 'PUBLISHED' ? 'default' : 'secondary'}>{job.status}</Badge>
                          <span className="text-sm text-muted-foreground">{job.location}</span>
                        </div>
                        {(creatorDisplayName || creatorDisplayEmail) && (
                          <div className="pt-0.5">
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800/80 px-2.5 py-0.5 rounded-md border border-border/50">
                              <User className="h-3 w-3 text-slate-400" />
                              <span>
                                Người tạo: {creatorDisplayName ? `${creatorDisplayName}${creatorDisplayEmail ? ` (${creatorDisplayEmail})` : ''}` : creatorDisplayEmail}
                              </span>
                            </span>
                          </div>
                        )}
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
                            onClick={() => handleClose(job.id, job.version)}
                            disabled={closeMutation.isPending}
                          >
                            Close
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
                        <Link
                          to="/recruiter/jobs/$jobId/applicants"
                          params={{ jobId: job.id }}
                          search={{ companyId }}
                        >
                          Manage Applicants
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </StateBoundary>

      <ConfirmDialog
        open={!!closingJob}
        onOpenChange={(open) => !open && setClosingJob(null)}
        title="Close Job"
        description="Are you sure you want to close this job? Candidates will no longer be able to submit applications."
        confirmText="Close Job"
        variant="destructive"
        isLoading={closeMutation.isPending}
        onConfirm={() => {
          if (closingJob) {
            closeMutation.mutate(
              { jobId: closingJob.id, expectedVersion: closingJob.version, reason: 'Closed by recruiter' },
              {
                onSuccess: () => {
                  showFlash('success', 'Job closed successfully');
                  setClosingJob(null);
                },
                onError: (err) => {
                  showFlash('error', `Failed to close job: ${err.message}`);
                  setClosingJob(null);
                },
              }
            );
          }
        }}
      />
    </div>
  );
}
