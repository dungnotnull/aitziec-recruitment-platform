import React, { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import type { JobSearchFilters } from '@/api/types';

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

  return (
    <form onSubmit={handleApply} className="space-y-6 bg-card p-4 rounded-lg border">
      <div>
        <h3 className="text-lg font-medium mb-4">Filters</h3>
      </div>

      <div className="space-y-2">
        <Label htmlFor="search">Keywords</Label>
        <Input
          id="search"
          placeholder="Job title, skills, or company"
          value={filters.q || ''}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="e.g. Ho Chi Minh, Ha Noi"
          value={filters.location?.[0] || ''}
          onChange={(e) => setFilters({ ...filters, location: e.target.value ? [e.target.value] : undefined })}
        />
      </div>

      <div className="pt-4 flex gap-2">
        <Button type="submit" className="flex-1">Apply Filters</Button>
        <Button type="button" variant="outline" onClick={handleReset}>Reset</Button>
      </div>
    </form>
  );
};
