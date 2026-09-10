import React, { useState } from 'react';
import { useCreateJob, useUpdateJob } from '../hooks/useJobs';
import type { CreateJobRequest, Job } from '@/api/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

interface JobEditorProps {
  companyId: string;
  initialJob?: Job;
  onSuccess?: () => void;
}

export const JobEditor: React.FC<JobEditorProps> = ({ companyId, initialJob, onSuccess }) => {
  const isEditing = !!initialJob;
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();

  const [formData, setFormData] = useState<CreateJobRequest>({
    title: initialJob?.title || '',
    description: initialJob?.description || '',
    requirements: initialJob?.requirements || '',
    responsibilities: initialJob?.responsibilities || '',
    technologyNames: initialJob?.technologyNames || [],
    location: initialJob?.location || '',
    workplaceType: initialJob?.workplaceType || 'ONSITE',
    experienceLevel: initialJob?.experienceLevel || 'MID',
    employmentType: initialJob?.employmentType || 'FULL_TIME',
    salaryMin: initialJob?.salaryMin || null,
    salaryMax: initialJob?.salaryMax || null,
    currency: initialJob?.currency || 'VND',
    applicationDeadline: initialJob?.applicationDeadline || new Date().toISOString().split('T')[0],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTechChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const techs = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
    setFormData((prev) => ({
      ...prev,
      technologyNames: techs,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value ? parseInt(value, 10) : null,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && initialJob) {
      updateJob.mutate(
        { jobId: initialJob.id, data: { ...formData, expectedVersion: initialJob.version } },
        { onSuccess }
      );
    } else {
      createJob.mutate(
        { companyId, data: formData },
        { onSuccess }
      );
    }
  };

  const isPending = createJob.isPending || updateJob.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4 bg-card p-6 rounded-lg border shadow-sm">
        <h2 className="text-xl font-semibold mb-4">
          {isEditing ? 'Edit Job' : 'Create New Job'}
        </h2>

        <div className="space-y-2">
          <Label htmlFor="title">Job Title *</Label>
          <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input id="location" name="location" value={formData.location} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="applicationDeadline">Application Deadline *</Label>
            <Input
              id="applicationDeadline"
              name="applicationDeadline"
              type="date"
              value={formData.applicationDeadline.split('T')[0]}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="workplaceType">Workplace Type *</Label>
            <select
              id="workplaceType"
              name="workplaceType"
              value={formData.workplaceType}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="ONSITE">On-site</option>
              <option value="HYBRID">Hybrid</option>
              <option value="REMOTE">Remote</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="employmentType">Employment Type *</Label>
            <select
              id="employmentType"
              name="employmentType"
              value={formData.employmentType}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="experienceLevel">Experience Level *</Label>
            <select
              id="experienceLevel"
              name="experienceLevel"
              value={formData.experienceLevel}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="INTERN">Intern</option>
              <option value="FRESHER">Fresher</option>
              <option value="JUNIOR">Junior</option>
              <option value="MID">Mid-level</option>
              <option value="SENIOR">Senior</option>
              <option value="LEAD">Lead</option>
              <option value="MANAGER">Manager</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="technologyNames">Technologies (comma separated)</Label>
          <Input
            id="technologyNames"
            name="technologyNames"
            value={formData.technologyNames.join(', ')}
            onChange={handleTechChange}
            placeholder="e.g. React, Node.js, PostgreSQL"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" name="currency" value={formData.currency} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salaryMin">Min Salary (optional)</Label>
            <Input id="salaryMin" name="salaryMin" type="number" value={formData.salaryMin || ''} onChange={handleNumberChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salaryMax">Max Salary (optional)</Label>
            <Input id="salaryMax" name="salaryMax" type="number" value={formData.salaryMax || ''} onChange={handleNumberChange} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="requirements">Requirements *</Label>
          <textarea
            id="requirements"
            name="requirements"
            value={formData.requirements}
            onChange={handleChange}
            required
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsibilities">Responsibilities (optional)</Label>
          <textarea
            id="responsibilities"
            name="responsibilities"
            value={formData.responsibilities || ''}
            onChange={handleChange}
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEditing ? 'Update Job' : 'Create Job'}
        </Button>
      </div>
    </form>
  );
};
