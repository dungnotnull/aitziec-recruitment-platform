import { createFileRoute } from '@tanstack/react-router';
import { SavedJobsList } from '@/features/saved-jobs/components/SavedJobsList';

export const Route = createFileRoute('/_authenticated/candidate/saved-jobs')({
  component: SavedJobsPage,
});

function SavedJobsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <SavedJobsList />
    </div>
  );
}
