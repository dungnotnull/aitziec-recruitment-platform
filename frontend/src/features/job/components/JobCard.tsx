import React from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import type { Job } from '@/api/types';

interface JobCardProps {
  job: Job;
}

export const JobCard: React.FC<JobCardProps> = ({ job }) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <Link to="/jobs/$jobIdOrSlug" params={{ jobIdOrSlug: job.slug }} className="hover:underline">
              <CardTitle className="text-xl text-primary">{job.title}</CardTitle>
            </Link>
            <div className="text-sm text-muted-foreground mt-1">
              {job.company.name} • {job.location}
            </div>
          </div>
          {job.company.logoUrl && (
            <img
              src={job.company.logoUrl}
              alt={`${job.company.name} logo`}
              className="h-10 w-10 object-contain rounded"
            />
          )}
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
