import { createFileRoute, useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { RecruiterPipeline } from '@/features/application/components/RecruiterPipeline';

export const Route = createFileRoute('/_authenticated/recruiter/jobs/$jobId/applicants')({
  validateSearch: (search: Record<string, unknown>) => ({
    companyId: typeof search.companyId === 'string' ? search.companyId : undefined,
  }),
  component: ApplicantsPage,
});

function ApplicantsPage() {
  const { jobId } = Route.useParams();
  const search = Route.useSearch();
  const router = useRouter();

  const handleBack = () => {
    router.navigate({
      to: '/recruiter/workspace',
      search: { companyId: search.companyId },
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Button
        variant="ghost"
        className="mb-6 gap-2"
        onClick={handleBack}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Job Workspace
      </Button>
      <RecruiterPipeline jobId={jobId} />
    </div>
  );
}
