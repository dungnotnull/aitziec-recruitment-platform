import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getCompany } from '@/features/company/api';
import { getCompanyExtendedInfo } from '@/features/company/company-meta';
import { useAuth } from '@/features/auth/context';
import { jobApi } from '@/features/job/api/job.api';
import { JobCard } from '@/features/job/components/JobCard';
import {
  Building2,
  MapPin,
  ExternalLink,
  Briefcase,
  ArrowLeft,
  Globe,
  ShieldCheck,
  Sparkles,
  Heart,
  Share2,
  Check,
  DollarSign,
  Laptop,
  Coffee,
  Plane,
  Clock,
  Award,
  Users,
  CalendarDays,
  Edit,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/shared/ui/alert';

export const Route = createFileRoute('/_authenticated/companies/$companyIdOrSlug')({
  component: PublicCompanyDetailPage,
});

function PublicCompanyDetailPage() {
  const { companyIdOrSlug } = Route.useParams();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'perks'>('overview');
  const [isCopied, setIsCopied] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);

  // Fetch company details via public endpoint GET /companies/:companyIdOrSlug
  const {
    data: company,
    isLoading: isLoadingCompany,
    isError: isCompanyError,
    error: companyError,
  } = useQuery({
    queryKey: ['public-company-detail', companyIdOrSlug],
    queryFn: () => getCompany(companyIdOrSlug),
  });

  // Fetch company jobs via public endpoint GET /jobs?companyId=...
  const {
    data: jobsResponse,
    isLoading: isLoadingJobs,
  } = useQuery({
    queryKey: ['public-company-jobs', company?.id],
    queryFn: () => jobApi.getJobs({ companyId: company?.id }),
    enabled: !!company?.id,
  });

  const jobs = jobsResponse?.data || [];

  // Extended metadata configured by HR owner
  const ext = getCompanyExtendedInfo(company?.id);

  // Extract and combine technologies from owner settings and published jobs
  const companyTechStack = Array.from(
    new Set([...ext.techStack, ...jobs.flatMap((j) => j.technologyNames || [])])
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isLoadingCompany) {
    return (
      <div className="space-y-6 py-6 animate-pulse">
        <div className="h-64 bg-slate-200 dark:bg-zinc-800 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="h-44 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
            <div className="h-64 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 h-96 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isCompanyError || !company) {
    return (
      <div className="py-12 max-w-2xl mx-auto">
        <Alert variant="destructive" className="rounded-2xl border-red-200">
          <AlertTitle className="font-bold">Không tìm thấy công ty</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {(companyError as any)?.message ||
              "Công ty bạn đang tìm kiếm không tồn tại hoặc đã tạm dừng hoạt động."}
          </AlertDescription>
        </Alert>
        <Link
          to="/companies"
          className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-[#EA1E30] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh bạ công ty IT
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-ink transition-colors">Trang chủ</Link>
        <span>/</span>
        <Link to="/companies" className="hover:text-ink transition-colors">Công ty IT</Link>
        <span>/</span>
        <span className="font-medium text-ink truncate max-w-xs">{company.name}</span>
      </nav>

      {/* 2. ITviec Signature Hero Header Profile */}
      <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-surface shadow-sm overflow-hidden">
        {/* Cover Background Banner with Red Glow Pattern */}
        <div className="h-44 sm:h-56 bg-gradient-to-r from-[#121212] via-[#1E1E1E] to-[#121212] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#EA1E30_1px,transparent_1px)] [background-size:20px_20px] opacity-25" />
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#EA1E30]/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-4 right-4 hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-[#EA1E30]" />
            <span>Hồ sơ công ty tiêu chuẩn ITviec</span>
          </div>
        </div>

        {/* Profile Info Row */}
        <div className="px-6 sm:px-10 pb-6 pt-0 relative bg-surface">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              {/* Logo Box - Duy nhất logo dùng margin âm để nổi trên banner */}
              <div className="-mt-16 sm:-mt-20 h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-2xl border-4 border-surface bg-white shadow-xl flex items-center justify-center overflow-hidden p-2.5 relative z-20">
                {company.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt={`${company.name} logo`}
                    className="h-full w-full object-contain rounded-xl"
                  />
                ) : (
                  <Building2 className="h-14 w-14 text-blue-600" />
                )}
              </div>

              {/* Title, Badges & Quick Stats - Nằm hoàn toàn trên nền trắng bg-surface, text-ink rõ ràng 100% */}
              <div className="pt-2 sm:pt-0 sm:pb-1 space-y-2 relative z-10">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-ink tracking-tight">
                    {company.name}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                    <Building2 className="h-3 w-3 text-blue-600" />
                    <span>Công Ty IT</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Verified Employer</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-muted-foreground pt-1">
                  {company.location && (
                    <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{company.location}</span>
                    </div>
                  )}
                  {company.websiteUrl && (
                    <a
                      href={company.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      <Globe className="h-4 w-4 shrink-0" />
                      <span>{company.websiteUrl.replace(/^https?:\/\//, '')}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="flex items-center gap-1.5 font-bold text-[#EA1E30]">
                    <Briefcase className="h-4 w-4 shrink-0" />
                    <span>{jobs.length} Việc làm đang tuyển</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 shrink-0 pb-1 relative z-10">
              {session?.user?.role === 'HR' && (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl border-blue-200 dark:border-blue-900 bg-blue-50/50 hover:bg-blue-100/70 text-blue-700 dark:text-blue-300 text-xs font-semibold h-10 px-4"
                >
                  <Link to="/company/edit" search={{ companyId: company.id }}>
                    <Edit className="h-4 w-4 mr-1.5 text-blue-600" />
                    <span>Sửa hồ sơ</span>
                  </Link>
                </Button>
              )}

              <button
                type="button"
                onClick={() => setIsFollowed(!isFollowed)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  isFollowed
                    ? 'bg-rose-50 border-red-300 text-[#EA1E30]'
                    : 'border-slate-200 dark:border-zinc-700 bg-surface hover:bg-slate-100 text-ink'
                }`}
              >
                <Heart className={`h-4 w-4 ${isFollowed ? 'fill-[#EA1E30] text-[#EA1E30]' : 'text-slate-400'}`} />
                <span>{isFollowed ? 'Đã theo dõi' : 'Theo dõi'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-surface hover:bg-slate-100 text-ink text-xs font-semibold transition-all"
                title="Sao chép liên kết"
              >
                {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4 text-slate-400" />}
                <span>{isCopied ? 'Đã sao chép' : 'Chia sẻ'}</span>
              </button>

              <Button
                asChild
                className="bg-[#EA1E30] hover:bg-[#D01223] text-white font-bold text-xs h-10 px-5 rounded-xl shadow-md shadow-red-900/20"
              >
                <a href="#open-jobs">Xem {jobs.length} việc làm</a>
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-8 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`text-sm font-bold pb-2 border-b-2 transition-all ${
                activeTab === 'overview'
                  ? 'border-[#EA1E30] text-[#EA1E30]'
                  : 'border-transparent text-muted-foreground hover:text-ink'
              }`}
            >
              Tổng quan công ty
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('jobs')}
              className={`text-sm font-bold pb-2 border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'jobs'
                  ? 'border-[#EA1E30] text-[#EA1E30]'
                  : 'border-transparent text-muted-foreground hover:text-ink'
              }`}
            >
              <span>Việc làm</span>
              <span className="px-2 py-0.2 rounded-full text-[11px] font-extrabold bg-red-100 text-[#EA1E30] dark:bg-red-950/60">
                {jobs.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('perks')}
              className={`text-sm font-bold pb-2 border-b-2 transition-all ${
                activeTab === 'perks'
                  ? 'border-[#EA1E30] text-[#EA1E30]'
                  : 'border-transparent text-muted-foreground hover:text-ink'
              }`}
            >
              Phúc lợi & Văn hóa
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Details, Why join, Tech stack, and Open Jobs */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Card: Tại sao bạn sẽ thích làm việc tại đây (Signature ITviec Feature) */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 border-l-4 border-l-blue-600 bg-surface p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="font-display font-bold text-lg sm:text-xl text-ink">
                Tại sao bạn sẽ thích làm việc tại {company.name}
              </h2>
            </div>

            <div className="space-y-4">
              {ext.reasonsToJoin.map((reason, idx) => (
                <div key={idx} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/70 dark:border-zinc-800">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                    idx === 0
                      ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600'
                      : idx === 1
                      ? 'bg-rose-100 dark:bg-red-950/60 text-[#EA1E30]'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-ink">{reason.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {reason.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Giới thiệu công ty */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="font-display font-bold text-lg sm:text-xl text-ink">
                Về chúng tôi
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {company.description ||
                `${company.name} là một trong những doanh nghiệp công nghệ hàng đầu, tập trung cung cấp các giải pháp phần mềm, chuyển đổi số và phát triển ứng dụng chất lượng cao cho thị trường quốc tế.`}
            </p>
          </div>

          {/* Card: Công nghệ & Kỹ năng chính (Key Tech Stack) */}
          {companyTechStack.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <Laptop className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="font-display font-bold text-lg sm:text-xl text-ink">
                  Kỹ năng & Công nghệ chính
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {companyTechStack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-50/70 dark:bg-zinc-800 text-blue-800 dark:text-zinc-200 text-xs font-semibold border border-blue-200/80 dark:border-zinc-700 hover:scale-105 transition-transform cursor-default"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Card: Phúc lợi & Quyền lợi (chuẩn ITviec) */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Award className="h-5 w-5 text-[#EA1E30]" />
              <h2 className="font-display font-bold text-lg sm:text-xl text-ink">
                Chế độ đãi ngộ & Phúc lợi nổi bật
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {ext.perks.map((perk, idx) => {
                const perkIcons = [DollarSign, ShieldCheck, Laptop, CalendarDays, Coffee, Plane, Award];
                const IconComponent = perkIcons[idx % perkIcons.length];
                const iconColors = [
                  'bg-red-100 dark:bg-red-950/60 text-[#EA1E30]',
                  'bg-blue-100 dark:bg-blue-950/60 text-blue-600',
                  'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600',
                  'bg-purple-100 dark:bg-purple-950/60 text-purple-600',
                  'bg-amber-100 dark:bg-amber-950/60 text-amber-600',
                  'bg-sky-100 dark:bg-sky-950/60 text-sky-600',
                ];
                const colorClass = iconColors[idx % iconColors.length];

                return (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/30 space-y-2">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colorClass}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <h4 className="font-bold text-xs text-ink">{perk.title}</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {perk.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Việc làm đang tuyển (Open Jobs Section) */}
          <div
            id="open-jobs"
            className="rounded-2xl border border-slate-200 dark:border-zinc-800 border-l-4 border-l-[#EA1E30] bg-surface p-6 sm:p-8 shadow-xs space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-rose-50 text-[#EA1E30] border border-rose-200 dark:bg-red-950/60 dark:text-red-400 dark:border-red-800">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>Vị Trí Đang Mở</span>
                </span>
                <h2 className="font-display font-bold text-lg sm:text-xl text-ink">
                  Việc làm tại {company.name} ({jobs.length})
                </h2>
              </div>
              <Link to="/jobs" className="text-xs sm:text-sm font-semibold text-[#EA1E30] hover:underline">
                Xem tất cả việc làm IT →
              </Link>
            </div>

            {isLoadingJobs ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-44 bg-slate-100 dark:bg-zinc-800 animate-pulse rounded-xl border border-border" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-dashed border-border bg-slate-50/50 dark:bg-zinc-900/30 p-6">
                <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm text-ink">Hiện tại công ty chưa có việc làm mới nào.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Bạn có thể nhấn Theo dõi để nhận thông báo sớm nhất khi có tin tuyển dụng mới.
                </p>
                <Link
                  to="/jobs"
                  className="inline-block mt-4 text-xs font-bold text-[#EA1E30] hover:underline"
                >
                  Khám phá việc làm IT khác →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Company Info Widget & Details */}
        <div className="lg:col-span-4 space-y-6 sticky top-24 z-10">
          {/* Widget 1: Thông tin công ty */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 shadow-xs space-y-5">
            <h3 className="font-display font-bold text-base text-ink pb-3 border-b border-border flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span>Thông tin chung</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                  <span>Mô hình công ty</span>
                </span>
                <span className="font-bold text-ink text-right">{ext.companyModel}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span>Quy mô nhân sự</span>
                </span>
                <span className="font-bold text-ink text-right">{ext.companySize}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  <span>Quốc tịch công ty</span>
                </span>
                <span className="font-bold text-ink text-right">{ext.country}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Thời gian làm việc</span>
                </span>
                <span className="font-bold text-ink text-right">{ext.workingTime}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Award className="h-3.5 w-3.5 text-slate-400" />
                  <span>Chính sách làm thêm</span>
                </span>
                <span className="font-bold text-emerald-600 text-right">{ext.overtimePolicy}</span>
              </div>

              {company.websiteUrl && (
                <div className="flex items-start justify-between gap-3 pt-2 border-t border-border">
                  <span className="text-muted-foreground shrink-0">Website</span>
                  <a
                    href={company.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-blue-600 hover:underline truncate max-w-[160px] text-right"
                  >
                    {company.websiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Widget 2: Địa điểm văn phòng */}
          {company.location && (
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-surface p-6 shadow-xs space-y-3">
              <h3 className="font-display font-bold text-base text-ink pb-3 border-b border-border flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#EA1E30]" />
                <span>Địa điểm làm việc</span>
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {company.location}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200">
                  Văn phòng hiện đại & đầy đủ tiện ích
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
