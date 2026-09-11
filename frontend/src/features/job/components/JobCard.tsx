import React from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import type { Job } from '@/api/types';
import { Building2 } from 'lucide-react';

interface JobCardProps {
  job: Job;
}

export const JobCard: React.FC<JobCardProps> = ({ job }) => {
  return (
    <Card className="hover:shadow-md transition-shadow relative group">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-4">
          <div className="flex gap-4 items-start w-full">
            <div className="shrink-0 w-12 h-12 rounded-lg border border-border/50 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
              {job.company.logoUrl ? (
                <img
                  src={job.company.logoUrl}
                  alt={`${job.company.name} logo`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <Link to="/jobs/$jobIdOrSlug" params={{ jobIdOrSlug: job.slug }} className="hover:underline before:absolute before:inset-0 z-10">
                <CardTitle className="text-xl text-primary group-hover:text-action transition-colors">{job.title}</CardTitle>
              </Link>
              <div className="text-sm text-muted-foreground mt-1 font-medium">
                {job.company.name} <span className="opacity-50 mx-1">•</span> {job.location}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary">{job.workplaceType}</Badge>
          <Badge variant="secondary">{job.employmentType}</Badge>
          <Badge variant="secondary">{job.experienceLevel}</Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {job.description}
        </p>
        {job.salaryMin && job.salaryMax && (
          <div className="mt-3 text-sm font-medium text-green-600 dark:text-green-400">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: job.currency,
              maximumFractionDigits: 0,
            }).format(job.salaryMin)} - {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: job.currency,
              maximumFractionDigits: 0,
            }).format(job.salaryMax)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
