import { createFileRoute } from '@tanstack/react-router';
import { CvUploader } from '@/features/cv/components/CvUploader';
import { CvList } from '@/features/cv/components/CvList';
import { OperationTracker } from '@/features/operations/OperationTracker';

export const Route = createFileRoute('/_authenticated/candidate/cvs')({
  validateSearch: (search: Record<string, unknown>) => ({
    operationId: typeof search.operationId === 'string' ? search.operationId : undefined,
  }),
  component: CvsPage,
});

function CvsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-6">Manage CVs</h2>
        <CvUploader onOperationCreated={(operationId) => {
          void navigate({ search: { operationId }, replace: true });
        }} />
      </div>
      {search.operationId ? <OperationTracker operationId={search.operationId} /> : null}
      <div>
        <h3 className="text-xl font-semibold mb-4">Your CVs</h3>
        <CvList />
      </div>
    </div>
  );
}
