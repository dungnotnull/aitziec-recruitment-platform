import { useState, useMemo } from 'react'
import { createRoute, Link, useNavigate } from '@tanstack/react-router'
import { Route as authRoute } from '../_authenticated'
import { useQuery } from '@tanstack/react-query'
import { jobApi } from '@/features/job/api/job.api'
import { JobCard } from '@/features/job/components/JobCard'
import { CompanyCard, type CompanySummaryInfo } from '@/features/company/components/CompanyCard'
import { useAuth } from '@/features/auth/context'
import {
  Search,
  MapPin,
  Sparkles,
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  BrainCircuit,
  Briefcase,
  Flame,
} from 'lucide-react'
import { Button } from '@/shared/ui/button'

export const Route = createRoute({
  getParentRoute: () => authRoute,
  path: '/',
  component: HomePage,
})

const TRENDING_SKILLS = [
  'ReactJS',
  'NodeJS',
  'Java',
  'Python',
  'Golang',
  'TypeScript',
  'DevOps',
  'AWS',
  'Tester',
  'AI / ML',
]

function HomePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('ALL')

  // Fetch featured jobs for homepage
  const { data: jobsResponse, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['homepage-featured-jobs'],
    queryFn: () => jobApi.getJobs({ limit: 6 }),
    staleTime: 5 * 60 * 1000,
  });

  const jobs = jobsResponse?.data || [];

  // Extract top companies from jobs
  const topCompanies = useMemo(() => {
    const companyMap = new Map<string, CompanySummaryInfo>();
    for (const job of jobs) {
      if (!job.company) continue;
      const c = job.company;
      const existing = companyMap.get(c.id);
      if (existing) {
        existing.jobCount = (existing.jobCount || 0) + 1;
      } else {
        companyMap.set(c.id, {
          id: c.id,
          slug: c.slug || c.id,
          name: c.name,
          logoUrl: c.logoUrl,
          location: job.location,
          description: `Top employer hiring software engineers and tech talent.`,
          jobCount: 1,
          skills: job.technologyNames ? [...job.technologyNames] : [],
        });
      }
    }
    return Array.from(companyMap.values()).slice(0, 3);
  }, [jobs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void navigate({
      to: '/jobs',
      search: {
        q: keyword.trim() || undefined,
        location: location !== 'ALL' ? [location] : undefined,
      },
    });
  };

  return (
    <div className="space-y-16 pb-20">
      {/* 1. Hero Banner with Dark ITviec Style */}
      <section className="relative -mt-8 pt-16 pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#121212] via-[#18181B] to-[#121212] text-white border-b border-zinc-800 overflow-hidden">
        {/* Glow backdrop effects */}
        <div className="absolute left-1/2 -top-24 -translate-x-1/2 w-[800px] h-[350px] bg-[#EA1E30]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-5xl relative z-10 text-center space-y-6">
          {/* Welcome back chip if logged in */}
          {session ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Xin chào, {session.user.email}</span>
              <span className="text-[#EA1E30] font-bold">({session.user.role})</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-950/70 border border-red-800/40 text-xs font-bold text-[#EA1E30] tracking-wide uppercase">
              <Flame className="h-3.5 w-3.5 fill-[#EA1E30]" />
              <span>1,000+ Việc Làm IT Cho Developer Chất</span>
            </div>
          )}

          {/* Main Headline */}
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
            Việc Làm IT Hàng Đầu Cho <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-white via-zinc-200 to-[#EA1E30] bg-clip-text text-transparent">
              Developer Chất
            </span>
          </h1>

          <p className="text-zinc-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Khám phá các vị trí lương cao, phúc lợi hấp dẫn tại các công ty công nghệ uy tín tại Việt Nam và toàn cầu.
          </p>

          {/* ITviec Search Box Form */}
          <form
            onSubmit={handleSearch}
            className="mt-8 bg-zinc-900/90 p-3 sm:p-4 rounded-2xl border border-zinc-700/80 shadow-2xl backdrop-blur-md max-w-4xl mx-auto text-left"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* City selector */}
              <div className="md:col-span-4 relative flex items-center">
                <MapPin className="absolute left-3.5 h-4 w-4 text-zinc-400" />
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-zinc-800/90 border border-zinc-700 text-sm font-medium text-white focus:outline-none focus:border-[#EA1E30] focus:ring-1 focus:ring-red-500 transition-all cursor-pointer"
                >
                  <option value="ALL">Tất cả địa điểm</option>
                  <option value="Ho Chi Minh">TP. Hồ Chí Minh</option>
                  <option value="Ha Noi">Hà Nội</option>
                  <option value="Da Nang">Đà Nẵng</option>
                  <option value="Remote">Remote (Làm từ xa)</option>
                </select>
              </div>

              {/* Keyword / Skill input */}
              <div className="md:col-span-5 relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Từ khóa, kỹ năng (React, Java, Node, Python...)"
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-zinc-800/90 border border-zinc-700 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#EA1E30] focus:ring-1 focus:ring-red-500 transition-all"
                />
              </div>

              {/* Submit Search Button */}
              <div className="md:col-span-3">
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-[#EA1E30] hover:bg-[#D01223] text-white font-bold text-sm shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                  <span>Tìm Việc Ngay</span>
                </Button>
              </div>
            </div>

            {/* Trending Tech Pills */}
            <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-400 font-semibold flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-[#EA1E30]" />
                Kỹ năng hot:
              </span>
              {TRENDING_SKILLS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => {
                    setKeyword(skill);
                    void navigate({ to: '/jobs', search: { q: skill } });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium transition-all"
                >
                  {skill}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* 2. Platform Value Highlights */}
      <section className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-surface shadow-sm">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#EA1E30] flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-ink">Ứng Tuyển 1-Click</h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Nhanh chóng & tiện lợi</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-surface shadow-sm">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-ink">Công Ty Xác Thực</h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">100% doanh nghiệp uy tín</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-surface shadow-sm">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-ink">Minh Bạch Lương</h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Đãi ngộ & phúc lợi rõ ràng</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-surface shadow-sm">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-ink">Đánh Giá CV Bằng AI</h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Khớp yêu cầu công việc</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Top IT Companies / Spotlight Employers */}
      {topCompanies.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-surface/60 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/70">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Doanh Nghiệp Tiêu Biểu</span>
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
                  Nhà Tuyển Dụng Nổi Bật
                </h2>
              </div>
              <Link
                to="/companies"
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Xem tất cả công ty</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topCompanies.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. Featured & Urgent IT Jobs */}
      <section className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-surface/60 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/70">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-rose-50 text-[#EA1E30] border border-rose-200 dark:bg-red-950/60 dark:text-red-400 dark:border-red-800">
                <Briefcase className="h-3.5 w-3.5" />
                <span>Cơ Hội Mới Nhất</span>
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
                Việc Làm IT Mới Nhất
              </h2>
            </div>

            <Link
              to="/jobs"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#EA1E30] hover:underline"
            >
              <span>Xem tất cả {jobs.length > 0 ? `${jobs.length}+` : ''} việc làm</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {isLoadingJobs ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-surface animate-pulse rounded-xl border border-border" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-border bg-surface p-8">
              <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-ink">Hiện chưa có việc làm công khai nào.</p>
              <p className="text-xs text-muted-foreground mt-1">Vui lòng quay lại sau để cập nhật các tin tuyển dụng mới.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. For Employers CTA Banner */}
      <section className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-[#121212] via-zinc-900 to-[#18181B] p-8 sm:p-12 text-white border border-zinc-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center md:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-800/40 text-[#EA1E30] text-xs font-semibold">
              <Building2 className="h-3.5 w-3.5" />
              <span>Dành cho Nhà Tuyển Dụng</span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Đăng tin tuyển dụng và tìm kiếm Developer chất
            </h3>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
              Tiếp cận nguồn nhân tài công nghệ chất lượng cao, đánh giá hồ sơ tự động bằng công nghệ AI của ITZiec.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              to="/auth/register"
              className="h-12 px-6 rounded-xl bg-[#EA1E30] hover:bg-[#D01223] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition-all"
            >
              <span>Đăng Tin Tuyển Dụng</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
