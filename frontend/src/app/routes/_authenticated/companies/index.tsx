import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { jobApi } from '@/features/job/api/job.api';
import { CompanyCard, type CompanySummaryInfo } from '@/features/company/components/CompanyCard';
import { Button } from '@/shared/ui/button';
import { Search, Building2, Sparkles } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/companies/')({
  component: CompaniesDirectoryPage,
});

function CompaniesDirectoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');

  // Fetch published jobs to extract real company information
  const { data: jobsResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-companies-jobs'],
    queryFn: () => jobApi.getJobs({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  // Aggregate companies from jobs
  const companies = useMemo(() => {
    const jobs = jobsResponse?.data || [];
    const companyMap = new Map<string, CompanySummaryInfo>();

    for (const job of jobs) {
      const c = job.company;
      if (!c) continue;

      const existing = companyMap.get(c.id);
      if (existing) {
        existing.jobCount = (existing.jobCount || 0) + 1;
        if (job.technologyNames) {
          const combined = new Set([...(existing.skills || []), ...job.technologyNames]);
          existing.skills = Array.from(combined);
        }
      } else {
        companyMap.set(c.id, {
          id: c.id,
          slug: c.slug || c.id,
          name: c.name,
          logoUrl: c.logoUrl,
          location: job.location,
          description: `Top technology employer hiring software engineers, data, and cloud professionals.`,
          jobCount: 1,
          skills: job.technologyNames ? [...job.technologyNames] : [],
        });
      }
    }

    return Array.from(companyMap.values());
  }, [jobsResponse]);

  // Filter companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesSearch =
        !searchTerm.trim() ||
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.skills?.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesLocation =
        selectedLocation === 'ALL' ||
        (company.location && company.location.toLowerCase().includes(selectedLocation.toLowerCase()));

      return matchesSearch && matchesLocation;
    });
  }, [companies, searchTerm, selectedLocation]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-[#18181B] to-[#09090B] p-8 sm:p-12 text-white border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-72 w-72 rounded-full bg-[#EA1E30]/10 blur-3xl pointer-events-none" />
        
        <div className="max-w-2xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-800/40 text-[#EA1E30] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Top Tech Workplaces</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Khám phá các <span className="text-[#EA1E30]">Công Ty IT</span> Hàng Đầu
          </h1>

          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Tìm hiểu văn hóa, môi trường làm việc, chế độ đãi ngộ và danh sách việc làm mở từ các công ty công nghệ uy tín nhất tại Việt Nam.
          </p>

          {/* Search Controls inside Banner */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên công ty hoặc kỹ năng (React, Java, Python...)"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-zinc-900/90 border border-zinc-700 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#EA1E30] focus:ring-2 focus:ring-red-500/20 transition-all"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="h-11 px-4 rounded-xl bg-zinc-900/90 border border-zinc-700 text-sm text-white focus:outline-none focus:border-[#EA1E30]"
              >
                <option value="ALL">Tất cả địa điểm</option>
                <option value="Ho Chi Minh">TP. Hồ Chí Minh</option>
                <option value="Ha Noi">Hà Nội</option>
                <option value="Da Nang">Đà Nẵng</option>
                <option value="Remote">Remote</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Companies Grid Section with Crisp Framed Border */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface/70 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200/90 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80">
              <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Danh Bạ Công Ty</span>
            </span>
            <h2 className="font-display text-xl font-bold text-ink">
              {filteredCompanies.length} Công ty phù hợp
            </h2>
          </div>
          <Link to="/jobs" className="text-xs sm:text-sm font-semibold text-[#EA1E30] hover:underline">
            Xem tất cả việc làm IT →
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-56 bg-surface animate-pulse rounded-xl border border-border" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12 rounded-xl border border-border bg-surface p-8">
            <p className="text-sm text-red-500 mb-4">Không thể tải danh sách công ty.</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Thử lại
            </Button>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-surface p-8">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-lg text-ink">Chưa tìm thấy công ty nào</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc địa điểm.
            </p>
            {searchTerm && (
              <Button onClick={() => setSearchTerm('')} variant="outline" size="sm" className="mt-4">
                Xóa từ khóa tìm kiếm
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
