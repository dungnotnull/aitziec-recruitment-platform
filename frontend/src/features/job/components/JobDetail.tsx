import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useJobDetail } from '../hooks/useJobs';
import { useAuth } from '@/features/auth/context';
import { Button } from '@/shared/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/shared/ui/alert';
import { SavedJobButton } from '@/features/saved-jobs/components/SavedJobButton';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogHeader, DialogDescription } from '@/shared/ui/dialog';
import { ApplyForm } from '@/features/application/components/ApplyForm';
import {
  Building2,
  MapPin,
  Calendar,
  Lock,
  Flame,
  ArrowLeft,
  ExternalLink,
  LogIn,
  UserPlus,
} from 'lucide-react';

interface JobDetailProps {
  jobIdOrSlug: string;
}

export const JobDetail: React.FC<JobDetailProps> = ({ jobIdOrSlug }) => {
  const { session } = useAuth();
  const isLoggedIn = !!session;
  const isCandidate = session?.user?.role === 'CANDIDATE';
  const isHR = session?.user?.role === 'HR';

  const { data, isLoading, isError, error } = useJobDetail(jobIdOrSlug);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 py-6 animate-pulse">
        <div className="h-10 bg-muted rounded-xl w-1/4" />
        <div className="h-44 bg-surface rounded-2xl border border-border" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-96 bg-surface rounded-2xl border border-border" />
          <div className="h-72 bg-surface rounded-2xl border border-border" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 space-y-4">
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Không tìm thấy việc làm</AlertTitle>
          <AlertDescription>
            {error?.message || 'Việc làm bạn đang tìm kiếm không tồn tại hoặc đã hết hạn.'}
          </AlertDescription>
        </Alert>
        <Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-[#EA1E30]">
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách việc làm
        </Link>
      </div>
    );
  }

  const job = data?.data;

  if (!job) {
    return null;
  }

  const returnUrl = `/jobs/${job.slug || job.id}`;

  const workplaceLabel = {
    ONSITE: 'At office (Tại văn phòng)',
    HYBRID: 'Hybrid (Linh hoạt)',
    REMOTE: 'Remote (Làm từ xa)',
  }[job.workplaceType] || job.workplaceType;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Navigation Back Link */}
      <div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-[#EA1E30] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isHR ? 'Quay lại danh sách việc làm' : 'Xem tất cả việc làm IT'}
        </Link>
      </div>

      {/* Main Header Card (ITviec Style) */}
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          {/* Company Logo + Job Title */}
          <div className="flex items-start gap-5 flex-1 min-w-0">
            {/* Logo */}
            <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl border border-border/80 bg-white dark:bg-zinc-900 p-1.5 flex items-center justify-center overflow-hidden shadow-sm">
              {job.company.logoUrl ? (
                <img
                  src={job.company.logoUrl}
                  alt={`${job.company.name} logo`}
                  className="h-full w-full object-contain rounded-xl"
                />
              ) : (
                <Building2 className="h-10 w-10 text-slate-400" />
              )}
            </div>

            {/* Title, Company, Location */}
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded bg-red-100 text-[#EA1E30] dark:bg-red-950/60">
                  <Flame className="h-3 w-3 fill-[#EA1E30]" />
                  Tuyển Gấp
                </span>
                <span className="text-xs text-muted-foreground">
                  Hạn ứng tuyển: {new Date(job.applicationDeadline).toLocaleDateString()}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink leading-snug">
                {job.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link
                  to="/companies/$companyIdOrSlug"
                  params={{ companyIdOrSlug: job.company.slug || job.company.id }}
                  className="font-semibold text-slate-800 dark:text-zinc-200 hover:text-[#EA1E30] transition-colors flex items-center gap-1.5"
                >
                  <span>{job.company.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </Link>
                <span className="text-slate-300 dark:text-zinc-700">•</span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{job.location}</span>
                </div>
              </div>

              {/* Salary Display */}
              <div className="pt-2">
                {isLoggedIn ? (
                  job.salaryMin && job.salaryMax ? (
                    <div className="inline-flex items-center gap-2 text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <span>
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
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                      Mức lương thỏa thuận
                    </span>
                  )
                ) : (
                  // Salary privacy for unauthenticated guests
                  <Link
                    to="/auth/login"
                    search={{ redirect: returnUrl }}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#EA1E30] bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/60 px-3.5 py-1.5 rounded-xl transition-all shadow-sm"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Đăng nhập để xem mức lương</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Action CTAs (Apply & Save) */}
          <div className="flex flex-col gap-3 min-w-[220px] shrink-0 self-stretch sm:self-auto justify-center">
            {/* When NOT logged in: Gate login on Apply */}
            {!isLoggedIn ? (
              <Dialog open={isAuthPromptOpen} onOpenChange={setIsAuthPromptOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="w-full h-12 rounded-xl bg-[#EA1E30] hover:bg-[#D01223] text-white font-bold text-sm shadow-lg shadow-red-900/20"
                  >
                    Ứng Tuyển Ngay
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl">
                  <DialogHeader className="space-y-2">
                    <div className="h-12 w-12 rounded-2xl bg-red-50 text-[#EA1E30] flex items-center justify-center mx-auto mb-1">
                      <Lock className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-center font-display font-bold text-xl text-ink">
                      Đăng nhập để ứng tuyển
                    </DialogTitle>
                    <DialogDescription className="text-center text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Bạn cần đăng nhập tài khoản Ứng viên để nộp hồ sơ, tải lên CV và nhận thông báo phỏng vấn từ{' '}
                      <span className="font-semibold text-ink">{job.company.name}</span>.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 pt-4">
                    <Button
                      asChild
                      className="w-full h-11 rounded-xl bg-[#EA1E30] hover:bg-[#D01223] text-white font-bold text-sm shadow-md"
                    >
                      <Link to="/auth/login" search={{ redirect: returnUrl }}>
                        <LogIn className="h-4 w-4 mr-2" />
                        Đăng nhập để ứng tuyển
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-11 rounded-xl text-sm font-semibold"
                    >
                      <Link to="/auth/register" search={{ redirect: returnUrl }}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Tạo tài khoản mới
                      </Link>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : isCandidate ? (
              // Candidate logged in: Opens ApplyForm Dialog
              <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="w-full h-12 rounded-xl bg-[#EA1E30] hover:bg-[#D01223] text-white font-bold text-sm shadow-lg shadow-red-900/20"
                  >
                    Ứng Tuyển Ngay
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-display font-bold text-xl text-ink">
                      Ứng tuyển: {job.title}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Tại {job.company.name} • {job.location}
                    </DialogDescription>
                  </DialogHeader>
                  <ApplyForm
                    jobId={job.id}
                    onSuccess={() => {
                      alert('Hồ sơ của bạn đã được gửi thành công!');
                      setIsApplyOpen(false);
                    }}
                    onCancel={() => setIsApplyOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            ) : (
              // Recruiter / Admin note
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs text-center font-medium">
                Tài khoản Nhà tuyển dụng không thể ứng tuyển.
              </div>
            )}

            {/* Save Job Button */}
            {isCandidate && <SavedJobButton jobId={job.id} />}
          </div>
        </div>
      </div>

      {/* Grid: Details + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Content (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Job Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border bg-surface">
              <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                Hình thức
              </span>
              <p className="font-bold text-sm text-ink mt-1">{workplaceLabel}</p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface">
              <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                Cấp bậc
              </span>
              <p className="font-bold text-sm text-ink mt-1">{job.experienceLevel}</p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface">
              <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                Loại hình
              </span>
              <p className="font-bold text-sm text-ink mt-1">{job.employmentType}</p>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 space-y-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-ink pb-3 border-b border-border">
              Mô tả công việc (Job Description)
            </h2>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {job.description}
            </div>
          </div>

          {/* Requirements */}
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 space-y-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-ink pb-3 border-b border-border">
              Yêu cầu công việc (Job Requirements)
            </h2>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {job.requirements}
            </div>
          </div>

          {/* Responsibilities */}
          {job.responsibilities && (
            <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 space-y-4 shadow-sm">
              <h2 className="font-display text-lg font-bold text-ink pb-3 border-b border-border">
                Trách nhiệm chính (Responsibilities)
              </h2>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {job.responsibilities}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          {/* Company Card in Sidebar */}
          <div className="rounded-2xl border border-border bg-surface p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 rounded-xl border border-border bg-white dark:bg-zinc-900 p-1 flex items-center justify-center overflow-hidden">
                {job.company.logoUrl ? (
                  <img
                    src={job.company.logoUrl}
                    alt={`${job.company.name} logo`}
                    className="h-full w-full object-contain rounded-lg"
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-base text-ink truncate">
                  {job.company.name}
                </h3>
                <Link
                  to="/companies/$companyIdOrSlug"
                  params={{ companyIdOrSlug: job.company.slug || job.company.id }}
                  className="text-xs text-[#EA1E30] hover:underline font-semibold"
                >
                  Xem hồ sơ công ty →
                </Link>
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                <span>Hạn nộp: {new Date(job.applicationDeadline).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Tech Stack Pills in Sidebar */}
          {job.technologyNames && job.technologyNames.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-6 space-y-3 shadow-sm">
              <h3 className="font-display font-bold text-sm text-ink">Kỹ năng công nghệ yêu cầu</h3>
              <div className="flex flex-wrap gap-1.5">
                {job.technologyNames.map((tech) => (
                  <span
                    key={tech}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

