import React from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/shared/ui/card';
import type { Job } from '@/api/types';
import { Building2, MapPin, Lock, Flame, ArrowRight, Briefcase } from 'lucide-react';
import { useAuth } from '@/features/auth/context';

interface JobCardProps {
  job: Job;
}

export const JobCard: React.FC<JobCardProps> = ({ job }) => {
  const { session } = useAuth();
  const isLoggedIn = !!session;

  const workplaceLabel = {
    ONSITE: 'Tại văn phòng',
    HYBRID: 'Linh hoạt (Hybrid)',
    REMOTE: 'Làm từ xa (Remote)',
  }[job.workplaceType] || job.workplaceType;

  const workplaceColor = {
    REMOTE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80',
    HYBRID: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80',
    ONSITE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80',
  }[job.workplaceType] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <Card className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 border-l-4 border-l-[#EA1E30] bg-surface transition-all duration-200 hover:shadow-md hover:border-red-300 dark:hover:border-red-800 shadow-xs">
      <CardContent className="p-5">
        {/* Top Header Badge: Phân loại VIỆC LÀM IT rõ ràng bằng màu đỏ thương hiệu */}
        <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-50 text-[#EA1E30] border border-rose-200/90 dark:bg-red-950/60 dark:text-red-400 dark:border-red-800/80">
              <Briefcase className="h-3 w-3 text-[#EA1E30] dark:text-red-400" />
              <span>Việc Làm IT</span>
            </span>

            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300">
              <Flame className="h-3 w-3 fill-amber-500 text-amber-500" />
              HOT
            </span>
          </div>

          <span className="text-xs text-muted-foreground">
            Hạn nộp: {new Date(job.applicationDeadline).toLocaleDateString()}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          {/* Left: Logo & Job Info */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Company Logo */}
            <div className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 flex items-center justify-center overflow-hidden shadow-inner">
              {job.company.logoUrl ? (
                <img
                  src={job.company.logoUrl}
                  alt={`${job.company.name} logo`}
                  className="h-full w-full object-contain rounded-lg"
                />
              ) : (
                <Building2 className="h-7 w-7 text-blue-500/70" />
              )}
            </div>

            {/* Job Title & Company */}
            <div className="flex-1 min-w-0">
              <Link
                to="/jobs/$jobIdOrSlug"
                params={{ jobIdOrSlug: job.slug || job.id }}
                className="font-display font-bold text-lg text-ink group-hover:text-[#EA1E30] transition-colors line-clamp-1 block"
              >
                {job.title}
              </Link>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1.5">
                <Link
                  to="/companies/$companyIdOrSlug"
                  params={{ companyIdOrSlug: job.company.slug || job.company.id }}
                  className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400 hover:underline transition-colors truncate max-w-[200px]"
                >
                  <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">{job.company.name}</span>
                </Link>
                <span className="text-slate-300 dark:text-zinc-700">•</span>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{job.location}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Salary display */}
          <div className="shrink-0 self-start sm:self-auto">
            {isLoggedIn ? (
              job.salaryMin && job.salaryMax ? (
                <div className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: job.currency,
                    maximumFractionDigits: 0,
                  }).format(job.salaryMin)}{' '}
                  -{' '}
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: job.currency,
                    maximumFractionDigits: 0,
                  }).format(job.salaryMax)}
                </div>
              ) : (
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                  Thỏa thuận
                </span>
              )
            ) : (
              // Unauthenticated salary gate - signature ITviec feature
              <Link
                to="/auth/login"
                search={{ redirect: `/jobs/${job.slug || job.id}` }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/60 text-[#EA1E30] text-xs font-semibold shadow-sm transition-all"
                title="Đăng nhập để xem mức lương"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Đăng nhập để xem lương</span>
              </Link>
            )}
          </div>
        </div>

        {/* Middle: Workplace, Level, and Description */}
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${workplaceColor}`}>
              {workplaceLabel}
            </span>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60">
              {job.employmentType}
            </span>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60">
              {job.experienceLevel}
            </span>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
            {job.description}
          </p>

          {/* Technology badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {job.technologyNames && job.technologyNames.slice(0, 5).map((tech) => (
                <span
                  key={tech}
                  className="text-[11px] px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors border border-slate-200/70 dark:border-zinc-700/60"
                >
                  {tech}
                </span>
              ))}
              {job.technologyNames && job.technologyNames.length > 5 && (
                <span className="text-[11px] px-2 py-0.5 rounded-md text-slate-400 font-medium">
                  +{job.technologyNames.length - 5}
                </span>
              )}
            </div>

            {/* View Details Link */}
            <Link
              to="/jobs/$jobIdOrSlug"
              params={{ jobIdOrSlug: job.slug || job.id }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#EA1E30] hover:text-[#D01223] transition-colors ml-auto"
            >
              <span>Xem chi tiết</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

