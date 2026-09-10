import { createFileRoute } from '@tanstack/react-router';
import { JobDetail } from '@/features/job/components/JobDetail';

export const Route = createFileRoute('/jobs/$jobIdOrSlug')({
  component: JobDetailPage,
});

function JobDetailPage() {
  const { jobIdOrSlug } = Route.useParams();

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <JobDetail jobIdOrSlug={jobIdOrSlug} />
    </div>
  );
}
