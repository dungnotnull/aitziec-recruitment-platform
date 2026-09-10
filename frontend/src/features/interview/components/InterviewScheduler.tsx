import React, { useState } from 'react';
import { useCreateInterview, useUpdateInterview } from '../hooks/useInterview';
import type { CreateInterviewRequest, Interview } from '@/api/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

interface InterviewSchedulerProps {
  applicationId: string;
  initialInterview?: Interview;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const InterviewScheduler: React.FC<InterviewSchedulerProps> = ({
  applicationId,
  initialInterview,
  onSuccess,
  onCancel,
}) => {
  const isEditing = !!initialInterview;
  const createInterview = useCreateInterview();
  const updateInterview = useUpdateInterview();

  // Convert UTC string to local datetime-local format
  const formatForInput = (utcString: string) => {
    if (!utcString) return '';
    const date = new Date(utcString);
    // Adjust for local timezone offset to display correctly in datetime-local
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  const [formData, setFormData] = useState({
    startsAt: initialInterview ? formatForInput(initialInterview.startsAt) : '',
    endsAt: initialInterview ? formatForInput(initialInterview.endsAt) : '',
    locationOrMeetingUrl: initialInterview?.locationOrMeetingUrl || '',
    candidateInstructions: initialInterview?.candidateInstructions || '',
    recruiterPrivateNotes: initialInterview?.recruiterPrivateNotes || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Convert local datetime back to UTC ISO string
    const payload: CreateInterviewRequest = {
      startsAt: new Date(formData.startsAt).toISOString(),
      endsAt: new Date(formData.endsAt).toISOString(),
      locationOrMeetingUrl: formData.locationOrMeetingUrl,
      candidateInstructions: formData.candidateInstructions || null,
      recruiterPrivateNotes: formData.recruiterPrivateNotes || null,
    };

    if (isEditing && initialInterview) {
      updateInterview.mutate(
        {
          interviewId: initialInterview.id,
          data: { ...payload, expectedVersion: initialInterview.version },
        },
        { onSuccess }
      );
    } else {
      createInterview.mutate(
        { applicationId, data: payload },
        { onSuccess }
      );
    }
  };

  const isPending = createInterview.isPending || updateInterview.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-lg border">
      <h3 className="text-lg font-semibold mb-4">
        {isEditing ? 'Reschedule/Edit Interview' : 'Schedule Interview'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startsAt">Start Time (Local) *</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            value={formData.startsAt}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">End Time (Local) *</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            value={formData.endsAt}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="locationOrMeetingUrl">Location or Meeting URL *</Label>
        <Input
          id="locationOrMeetingUrl"
          name="locationOrMeetingUrl"
          value={formData.locationOrMeetingUrl}
          onChange={handleChange}
          required
          placeholder="e.g. Google Meet link or office address"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="candidateInstructions">Instructions for Candidate (Visible to them)</Label>
        <textarea
          id="candidateInstructions"
          name="candidateInstructions"
          value={formData.candidateInstructions}
          onChange={handleChange}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recruiterPrivateNotes">Private Notes (Recruiter Only)</Label>
        <textarea
          id="recruiterPrivateNotes"
          name="recruiterPrivateNotes"
          value={formData.recruiterPrivateNotes}
          onChange={handleChange}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEditing ? 'Update Interview' : 'Schedule Interview'}
        </Button>
      </div>
    </form>
  );
};
