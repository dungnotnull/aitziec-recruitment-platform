import React from 'react';
import { JobCard } from './JobCard';
import type { JobSearchFilters } from '@/api/types';
import { useJobs } from '../hooks/useJobs';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Briefcase, RotateCcw } from 'lucide-react';

interface JobListProps {
  filters?: JobSearchFilters;
}

export const JobList: React.FC<JobListProps> = ({ filters }) => {
  const { data, isLoading, isError, error, refetch } = useJobs(filters);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 bg-surface animate-pulse rounded-2xl border border-border" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertTitle>Lỗi tải danh sách việc làm</AlertTitle>
        <AlertDescription>
          {error?.message || 'Đã có lỗi xảy ra trong quá trình tải dữ liệu.'}
        </AlertDescription>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Thử lại
        </Button>
      </Alert>
    );
  }

  const jobs = data?.data || [];

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 px-6 border-2 border-dashed border-border rounded-2xl bg-surface">
        <div className="h-12 w-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-[#EA1E30] flex items-center justify-center mx-auto mb-3">
          <Briefcase className="h-6 w-6" />
        </div>
        <h3 className="font-display font-bold text-lg text-ink">Không tìm thấy việc làm phù hợp</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
          Hãy thử tìm kiếm bằng từ khóa khác hoặc điều chỉnh các tiêu chí bộ lọc (địa điểm, cấp bậc, hình thức làm việc).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs sm:text-sm font-bold text-ink">
          Hiển thị <span className="text-[#EA1E30]">{jobs.length}</span> việc làm IT
        </p>
      </div>

      <div className="space-y-4">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {data?.meta?.page?.hasNextPage && (
        <div className="flex justify-center pt-6">
          <Button variant="outline" className="rounded-xl px-6">
            Tải thêm việc làm
          </Button>
        </div>
      )}
    </div>
  );
};

