import React from 'react';
import { Link } from '@tanstack/react-router';
import { Building2, MapPin, ExternalLink, Briefcase } from 'lucide-react';

export interface CompanySummaryInfo {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  location?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  jobCount?: number;
  skills?: string[];
}

interface CompanyCardProps {
  company: CompanySummaryInfo;
}

export const CompanyCard: React.FC<CompanyCardProps> = ({ company }) => {
  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 dark:border-zinc-800 border-l-4 border-l-blue-600 bg-surface p-5 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200">
      {/* Top Header Badge: Phân loại CÔNG TY IT rõ ràng bằng màu xanh dương */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border/60">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/90 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80">
          <Building2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          <span>Công Ty IT</span>
        </span>

        {company.jobCount !== undefined && company.jobCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{company.jobCount} vị trí đang tuyển</span>
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Doanh nghiệp IT</span>
        )}
      </div>

      {/* Main info: Logo + Name */}
      <div className="flex items-start gap-4 mb-3">
        <div className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center overflow-hidden p-1 shadow-inner">
          {company.logoUrl ? (
            <img
              src={company.logoUrl}
              alt={`${company.name} logo`}
              className="h-full w-full object-contain rounded-lg"
            />
          ) : (
            <Building2 className="h-7 w-7 text-blue-500/70" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <Link
            to="/companies/$companyIdOrSlug"
            params={{ companyIdOrSlug: company.slug || company.id }}
            className="font-display font-bold text-base text-ink group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate block"
          >
            {company.name}
          </Link>
          {company.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{company.location}</span>
            </div>
          )}
          {company.websiteUrl && (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 mt-0.5 truncate transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">{company.websiteUrl.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
      </div>

      {/* Description excerpt */}
      {company.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {company.description}
        </p>
      )}

      {/* Tech stack badges */}
      {company.skills && company.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {company.skills.slice(0, 4).map((tech) => (
            <span
              key={tech}
              className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50/60 dark:bg-zinc-800 text-blue-800 dark:text-zinc-300 font-medium border border-blue-100 dark:border-zinc-700"
            >
              {tech}
            </span>
          ))}
          {company.skills.length > 4 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md text-slate-400 font-medium">
              +{company.skills.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Bottom bar: Jobs count & Link */}
      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
          <Briefcase className="h-3.5 w-3.5" />
          <span>{company.jobCount !== undefined ? `${company.jobCount} việc làm` : 'Xem việc làm'}</span>
        </div>

        <Link
          to="/companies/$companyIdOrSlug"
          params={{ companyIdOrSlug: company.slug || company.id }}
          className="text-xs font-semibold text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
        >
          Xem hồ sơ công ty →
        </Link>
      </div>
    </div>
  );
};
