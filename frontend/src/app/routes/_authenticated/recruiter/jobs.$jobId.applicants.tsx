import { createFileRoute, useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { RecruiterPipeline } from '@/features/application/components/RecruiterPipeline';

export const Route = createFileRoute('/_authenticated/recruiter/jobs/$jobId/applicants')({
  component: ApplicantsPage,
});

function ApplicantsPage() {
  const { jobId } = Route.useParams();
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Button
        variant="ghost"
        className="mb-6 gap-2"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>
      <RecruiterPipeline jobId={jobId} />
    </div>
  );
}
