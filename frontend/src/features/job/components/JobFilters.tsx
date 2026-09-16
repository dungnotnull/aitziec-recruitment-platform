import React, { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import type { JobSearchFilters, WorkplaceType, EmploymentType, ExperienceLevel } from '@/api/types';
import { Filter, RotateCcw } from 'lucide-react';

interface JobFiltersProps {
  initialFilters?: JobSearchFilters;
  onFilterChange: (filters: JobSearchFilters) => void;
}

export const JobFilters: React.FC<JobFiltersProps> = ({ initialFilters, onFilterChange }) => {
  const [filters, setFilters] = useState<JobSearchFilters>(initialFilters || {});

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange(filters);
  };

  const handleReset = () => {
    setFilters({});
    onFilterChange({});
  };

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)
  );

  return (
    <form onSubmit={handleApply} className="space-y-6 bg-surface p-5 rounded-2xl border border-border shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#EA1E30]" />
          <h3 className="font-display font-bold text-base text-ink">Bộ Lọc / Filters</h3>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-semibold text-[#EA1E30] hover:underline flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Đặt lại</span>
          </button>
        )}
      </div>

      {/* Keywords */}
      <div className="space-y-1.5">
        <Label htmlFor="search" className="text-xs font-bold text-ink">Từ khóa tìm kiếm</Label>
        <Input
          id="search"
          placeholder="Chức danh, kỹ năng, công ty..."
          value={filters.q || ''}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="h-10 text-xs rounded-xl"
        />
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label htmlFor="location-select" className="text-xs font-bold text-ink">Địa điểm làm việc</Label>
        <select
          id="location-select"
          className="min-h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-ink focus:outline-none focus:border-[#EA1E30]"
          value={filters.location?.[0] || ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              location: e.target.value ? [e.target.value] : undefined,
            })
          }
        >
          <option value="">Tất cả địa điểm</option>
          <option value="Ho Chi Minh">TP. Hồ Chí Minh</option>
          <option value="Ha Noi">Hà Nội</option>
          <option value="Da Nang">Đà Nẵng</option>
          <option value="Remote">Remote</option>
        </select>
      </div>

      {/* Workplace Type */}
      <div className="space-y-1.5">
        <Label htmlFor="workplace-type" className="text-xs font-bold text-ink">Hình thức làm việc</Label>
        <select
          id="workplace-type"
          className="min-h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-ink focus:outline-none focus:border-[#EA1E30]"
          value={filters.workplaceType?.[0] || ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              workplaceType: e.target.value ? [e.target.value as WorkplaceType] : undefined,
            })
          }
        >
          <option value="">Tất cả hình thức</option>
          <option value="ONSITE">Làm tại văn phòng (At office)</option>
          <option value="HYBRID">Linh hoạt (Hybrid)</option>
          <option value="REMOTE">Làm từ xa (Remote)</option>
        </select>
      </div>

      {/* Experience Level */}
      <div className="space-y-1.5">
        <Label htmlFor="experience-level" className="text-xs font-bold text-ink">Cấp bậc / Level</Label>
        <select
          id="experience-level"
          className="min-h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-ink focus:outline-none focus:border-[#EA1E30]"
          value={filters.experienceLevel?.[0] || ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              experienceLevel: e.target.value ? [e.target.value as ExperienceLevel] : undefined,
            })
          }
        >
          <option value="">Tất cả cấp bậc</option>
          <option value="INTERN">Intern</option>
          <option value="FRESHER">Fresher</option>
          <option value="JUNIOR">Junior</option>
          <option value="MID">Mid-level</option>
          <option value="SENIOR">Senior</option>
          <option value="LEAD">Lead / Principal</option>
          <option value="MANAGER">Manager</option>
        </select>
      </div>

      {/* Employment Type */}
      <div className="space-y-1.5">
        <Label htmlFor="employment-type" className="text-xs font-bold text-ink">Loại hợp đồng</Label>
        <select
          id="employment-type"
          className="min-h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-ink focus:outline-none focus:border-[#EA1E30]"
          value={filters.employmentType?.[0] || ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              employmentType: e.target.value ? [e.target.value as EmploymentType] : undefined,
            })
          }
        >
          <option value="">Tất cả loại hình</option>
          <option value="FULL_TIME">Toàn thời gian (Full-time)</option>
          <option value="PART_TIME">Bán thời gian (Part-time)</option>
          <option value="CONTRACT">Hợp đồng (Contract)</option>
          <option value="INTERNSHIP">Thực tập (Internship)</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col gap-2">
        <Button
          type="submit"
          className="w-full h-11 rounded-xl bg-[#EA1E30] hover:bg-[#D01223] text-white font-bold text-xs shadow-md shadow-red-900/20"
        >
          Áp dụng bộ lọc
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          className="w-full h-10 rounded-xl text-xs"
        >
          Xóa tất cả
        </Button>
      </div>
    </form>
  );
};

