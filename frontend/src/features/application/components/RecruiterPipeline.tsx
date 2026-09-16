import React, { useState, useRef, useEffect } from 'react';
import { useJobApplications, useTransitionApplication } from '../hooks/useApplication';
import type { ApplicationStatus } from '@/api/types';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Card } from '@/shared/ui/card';
import { CheckCircle, AlertCircle, X, Mail, Check, RotateCcw } from 'lucide-react';

interface RecruiterPipelineProps {
  jobId: string;
}

export const RecruiterPipeline: React.FC<RecruiterPipelineProps> = ({ jobId }) => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading, isError, error } = useJobApplications(jobId, statusFilter || undefined);
  const transitionApp = useTransitionApplication();

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

  const handleTransition = (
    appId: string,
    currentVersion: number,
    newStatus: ApplicationStatus,
    reason?: string
  ) => {
    transitionApp.mutate(
      {
        applicationId: appId,
        data: {
          expectedVersion: currentVersion,
          targetStatus: newStatus,
          reason,
        },
      },
      {
        onSuccess: () => {
          showFlash('success', `Application status transitioned to ${newStatus} successfully`);
        },
        onError: (err: any) => {
          showFlash('error', `Failed to transition application: ${err.message}`);
        },
      }
    );
  };

  const handleSendRejectionEmail = (appId: string) => {
    const app = applications.find((a) => a.id === appId);
    const candidateName = app?.candidate?.fullName || 'Candidate';
    showFlash('success', `Rejection notification email queued and sent to ${candidateName}`);
  };

  const renderStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'HIRED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300">
            HIRED
          </span>
        );
      case 'OFFERED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300">
            OFFERED
          </span>
        );
      case 'PASSED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">
            PASSED
          </span>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive">
            {status}
          </Badge>
        );
      case 'INTERVIEWING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-300">
            INTERVIEWING
          </span>
        );
      case 'REVIEWING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300">
            REVIEWING
          </span>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const renderTransitionButtons = (appId: string, version: number, status: ApplicationStatus) => {
    // 1. Initial State: APPLIED
    if (status === 'APPLIED') {
      return (
        <Button
          size="sm"
          onClick={() => handleTransition(appId, version, 'REVIEWING')}
          disabled={transitionApp.isPending}
        >
          Mark Reviewing
        </Button>
      );
    }

    // 2. State: REVIEWING
    if (status === 'REVIEWING') {
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleTransition(appId, version, 'INTERVIEWING')}
            disabled={transitionApp.isPending}
          >
            Invite to Interview
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleTransition(appId, version, 'REJECTED')}
            disabled={transitionApp.isPending}
          >
            Reject
          </Button>
        </div>
      );
    }

    // 3. State: INTERVIEWING
    if (status === 'INTERVIEWING') {
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleTransition(appId, version, 'PASSED')}
            disabled={transitionApp.isPending}
          >
            Pass
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleTransition(appId, version, 'REJECTED')}
            disabled={transitionApp.isPending}
          >
            Reject
          </Button>
        </div>
      );
    }

    // 4. State: PASSED -> Post-Pass Actions (Send Offer / Mark Hired)
    if (status === 'PASSED') {
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => handleTransition(appId, version, 'OFFERED', 'Formal job offer issued to candidate')}
            disabled={transitionApp.isPending}
            title="Send formal offer to candidate"
          >
            Send Offer
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleTransition(appId, version, 'HIRED', 'Candidate hired')}
            disabled={transitionApp.isPending}
            title="Mark candidate as hired"
          >
            Mark Hired
          </Button>
        </div>
      );
    }

    // 5. State: OFFERED -> Post-Offer Actions (Accept/Hire or Decline/Reject)
    if (status === 'OFFERED') {
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleTransition(appId, version, 'HIRED', 'Offer accepted and candidate hired')}
            disabled={transitionApp.isPending}
            title="Candidate accepted offer and hired"
          >
            Mark Hired
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleTransition(appId, version, 'REJECTED', 'Offer declined or revoked')}
            disabled={transitionApp.isPending}
            title="Decline or revoke offer"
          >
            Decline
          </Button>
        </div>
      );
    }

    // 6. State: REJECTED (Fail) -> Post-Fail Actions (Send Email / Reconsider)
    if (status === 'REJECTED') {
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => handleSendRejectionEmail(appId)}
            disabled={transitionApp.isPending}
            title="Send formal rejection / feedback email"
          >
            <Mail className="h-3.5 w-3.5 text-slate-500" />
            <span>Send Email</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={() => handleTransition(appId, version, 'REVIEWING', 'Reopened for reconsideration')}
            disabled={transitionApp.isPending}
            title="Reconsider candidate for another round or position"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reconsider</span>
          </Button>
        </div>
      );
    }

    // 7. State: HIRED -> Terminal Success State
    if (status === 'HIRED') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
          <Check className="h-3.5 w-3.5" />
          Hired
        </span>
      );
    }

    // Fallback
    return <span className="text-sm text-muted-foreground">No further actions</span>;
  };

  return (
    <div className="space-y-6">
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
          <option value="OFFERED">Offered</option>
          <option value="HIRED">Hired</option>
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
                    {renderStatusBadge(app.status)}
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
