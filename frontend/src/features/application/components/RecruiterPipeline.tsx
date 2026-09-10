import React, { useState } from 'react';
import { useJobApplications, useTransitionApplication } from '../hooks/useApplication';
import type { ApplicationStatus } from '@/api/types';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Card } from '@/shared/ui/card';

interface RecruiterPipelineProps {
  jobId: string;
}

export const RecruiterPipeline: React.FC<RecruiterPipelineProps> = ({ jobId }) => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading, isError, error } = useJobApplications(jobId, statusFilter || undefined);
  const transitionApp = useTransitionApplication();

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Loading applicants...</div>;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error?.message || 'Failed to load applicants.'}</AlertDescription>
      </Alert>
    );
  }

  const applications = data?.data || [];

  const handleTransition = (appId: string, currentVersion: number, newStatus: ApplicationStatus) => {
    transitionApp.mutate({
      applicationId: appId,
      data: {
        expectedVersion: currentVersion,
        targetStatus: newStatus,
      }
    });
  };

  const renderTransitionButtons = (appId: string, version: number, status: ApplicationStatus) => {
    // APPLIED -> REVIEWING -> INTERVIEWING -> PASSED | REJECTED
    if (status === 'APPLIED') {
      return (
        <Button size="sm" onClick={() => handleTransition(appId, version, 'REVIEWING')} disabled={transitionApp.isPending}>
          Mark Reviewing
        </Button>
      );
    }
    if (status === 'REVIEWING') {
      return (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleTransition(appId, version, 'INTERVIEWING')} disabled={transitionApp.isPending}>
            Invite to Interview
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleTransition(appId, version, 'REJECTED')} disabled={transitionApp.isPending}>
            Reject
          </Button>
        </div>
      );
    }
    if (status === 'INTERVIEWING') {
      return (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleTransition(appId, version, 'PASSED')} disabled={transitionApp.isPending}>
            Pass
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleTransition(appId, version, 'REJECTED')} disabled={transitionApp.isPending}>
            Reject
          </Button>
        </div>
      );
    }
    // Terminal states
    return <span className="text-sm text-muted-foreground">No further actions</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Applicant Pipeline</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="APPLIED">Applied</option>
          <option value="REVIEWING">Reviewing</option>
          <option value="INTERVIEWING">Interviewing</option>
          <option value="PASSED">Passed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {applications.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground">No applicants found for this job.</p>
        </Card>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Candidate</th>
                <th className="px-4 py-3 font-medium">Applied On</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {applications.map((app) => (
                <tr key={app.id} className="bg-card hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {app.candidate.fullName}
                    <div className="text-xs text-muted-foreground font-normal mt-0.5 line-clamp-1">
                      {app.candidate.headline}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(app.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={
                      app.status === 'REJECTED' ? 'destructive' :
                      app.status === 'PASSED' ? 'default' : 'secondary'
                    }>
                      {app.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {renderTransitionButtons(app.id, app.version, app.status)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
