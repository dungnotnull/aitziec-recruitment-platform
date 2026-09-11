import { createFileRoute } from '@tanstack/react-router';
import { JobList } from '@/features/job/components/JobList';
import { JobFilters } from '@/features/job/components/JobFilters';
import { NaturalLanguageSearch } from '@/features/job/components/NaturalLanguageSearch';
import type { JobSearchFilters } from '@/api/types';
import { normalizeJobSearch } from '@/features/job/job-search-url';

export const Route = createFileRoute('/_authenticated/jobs/')({
  validateSearch: normalizeJobSearch,
  component: JobsPage,
});

function JobsPage() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const applyFilters = (next: JobSearchFilters) => {
    void navigate({ search: next, replace: true });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Find Your Next Job</h1>
      <div className="mb-8">
        <NaturalLanguageSearch onApply={applyFilters} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1">
          <JobFilters key={JSON.stringify(filters)} onFilterChange={applyFilters} initialFilters={filters} />
        </div>
        <div className="md:col-span-3">
          <JobList filters={filters} />
        </div>
      </div>
    </div>
  );
}
