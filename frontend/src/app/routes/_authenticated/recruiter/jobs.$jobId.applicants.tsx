import { createFileRoute } from '@tanstack/react-router';
import { RecruiterPipeline } from '@/features/application/components/RecruiterPipeline';

export const Route = createFileRoute('/_authenticated/recruiter/jobs/$jobId/applicants')({
  component: ApplicantsPage,
});

function ApplicantsPage() {
  const { jobId } = Route.useParams();

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <RecruiterPipeline jobId={jobId} />
    </div>
  );
}
