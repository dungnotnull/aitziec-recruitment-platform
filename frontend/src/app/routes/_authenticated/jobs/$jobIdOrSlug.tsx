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
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.history.back()} className="text-muted-foreground hover:text-foreground -ml-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Find Jobs
        </Button>
      </div>
      <JobDetail jobIdOrSlug={jobIdOrSlug} />
    </div>
  );
}
