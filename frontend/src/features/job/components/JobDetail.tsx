import React, { useState } from 'react';
import { useJobDetail } from '../hooks/useJobs';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/shared/ui/alert';
import { SavedJobButton } from '@/features/saved-jobs/components/SavedJobButton';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogHeader } from '@/shared/ui/dialog';
import { ApplyForm } from '@/features/application/components/ApplyForm';

interface JobDetailProps {
  jobIdOrSlug: string;
}

export const JobDetail: React.FC<JobDetailProps> = ({ jobIdOrSlug }) => {
  const { data, isLoading, isError, error } = useJobDetail(jobIdOrSlug);
  const [isApplyOpen, setIsApplyOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-muted rounded w-3/4" />
        <div className="h-6 bg-muted rounded w-1/4" />
        <div className="h-40 bg-muted rounded" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Job Not Found</AlertTitle>
        <AlertDescription>
          {error?.message || "The job you're looking for doesn't exist or is no longer available."}
        </AlertDescription>
      </Alert>
    );
  }

  const job = data?.data;

  if (!job) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <div className="mb-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => window.history.back()}
          className="text-muted-foreground hover:text-foreground pl-0 group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 transition-transform group-hover:-translate-x-1"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Back to Jobs
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{job.title}</h1>
          <div className="text-lg text-muted-foreground mt-2 flex items-center gap-2">
            <span>{job.company.name}</span>
            <span>•</span>
            <span>{job.location}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge>{job.workplaceType}</Badge>
            <Badge>{job.employmentType}</Badge>
            <Badge>{job.experienceLevel}</Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-[200px]">
          <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="w-full">Apply Now</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply for {job.title}</DialogTitle>
              </DialogHeader>
              <ApplyForm 
                jobId={job.id} 
                onSuccess={() => {
                  alert('Application submitted successfully!');
                  setIsApplyOpen(false);
                }} 
                onCancel={() => setIsApplyOpen(false)} 
              />
            </DialogContent>
          </Dialog>
          <SavedJobButton jobId={job.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Description</h2>
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
              {job.description}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Requirements</h2>
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
              {job.requirements}
            </div>
          </section>

          {job.responsibilities && (
            <section>
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Responsibilities</h2>
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                {job.responsibilities}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Salary</h3>
                <p className="font-medium mt-1">
                  {job.salaryMin && job.salaryMax ? (
                    <span className="text-green-600 dark:text-green-400">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: job.currency, maximumFractionDigits: 0 }).format(job.salaryMin)}
                      {' - '}
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: job.currency, maximumFractionDigits: 0 }).format(job.salaryMax)}
                    </span>
                  ) : (
                    "Not specified"
                  )}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Deadline</h3>
                <p className="font-medium mt-1">
                  {new Date(job.applicationDeadline).toLocaleDateString()}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground">Technologies</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {job.technologyNames.map((tech) => (
                    <Badge key={tech} variant="secondary">{tech}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
