import { createFileRoute, useRouter } from '@tanstack/react-router';
import { JobDetail } from '@/features/job/components/JobDetail';
import { Button } from '@/shared/ui/button';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/jobs/$jobIdOrSlug')({
  component: JobDetailPage,
});

function JobDetailPage() {
  const { jobIdOrSlug } = Route.useParams();
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <JobDetail jobIdOrSlug={jobIdOrSlug} />
    </div>
  );
}
