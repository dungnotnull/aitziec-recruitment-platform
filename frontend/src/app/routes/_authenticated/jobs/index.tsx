import { createFileRoute } from '@tanstack/react-router';
import { JobList } from '@/features/job/components/JobList';
import { JobFilters } from '@/features/job/components/JobFilters';
import { NaturalLanguageSearch } from '@/features/job/components/NaturalLanguageSearch';
import type { JobSearchFilters } from '@/api/types';
import { normalizeJobSearch } from '@/features/job/job-search-url';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/features/auth/context';

export const Route = createFileRoute('/_authenticated/jobs/')({
  validateSearch: normalizeJobSearch,
  component: JobsPage,
});

function JobsPage() {
  const { session } = useAuth();
  const isHR = session?.user?.role === 'HR';
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const applyFilters = (next: JobSearchFilters) => {
    void navigate({ search: next, replace: true });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#18181B] via-zinc-900 to-[#121212] p-6 sm:p-8 text-white border border-zinc-800 shadow-md">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-950/60 border border-red-800/40 text-[#EA1E30] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3 w-3" />
            <span>IT Jobs Marketplace</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white">
            Tìm Việc Làm IT Cho Developer Chất
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Khám phá hàng trăm cơ hội việc làm IT tại các công ty công nghệ hàng đầu với đãi ngộ minh bạch.
          </p>
        </div>
      </div>

      {/* AI Natural Language Search Drawer / Bar */}
      {!isHR && (
        <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
          <NaturalLanguageSearch onApply={applyFilters} />
        </div>
      )}

      {/* Main Content Grid with Framed Section Border */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface/60 p-6 sm:p-8 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar Filters */}
          <div className="lg:col-span-4 sticky top-20">
            <JobFilters key={JSON.stringify(filters)} onFilterChange={applyFilters} initialFilters={filters} />
          </div>

          {/* Job Listings Column */}
          <div className="lg:col-span-8">
            <JobList filters={filters} />
          </div>
        </div>
      </div>
    </div>
  );
}

