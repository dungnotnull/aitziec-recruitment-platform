import { createFileRoute, Link } from '@tanstack/react-router';
import { useCandidateApplications } from '@/features/application/hooks/useApplication';
import { Card, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { ApplicationHistory } from '@/features/application/components/ApplicationHistory';
import { InterviewList } from '@/features/interview/components/InterviewList';

export const Route = createFileRoute('/_authenticated/candidate/applications')({
  component: CandidateApplicationsPage,
});

function CandidateApplicationsPage() {
  const { data, isLoading, isError } = useCandidateApplications();

  if (isLoading) return <div className="p-8">Loading applications...</div>;
  if (isError) return <div className="p-8 text-destructive">Failed to load applications.</div>;

  const applications = data?.data || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <h2 className="text-2xl font-bold mb-6">My Applications</h2>

      {applications.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <p className="text-muted-foreground">You haven't applied to any jobs yet.</p>
        </div>
      ) : (
        applications.map((app) => (
          <Card key={app.id} className="overflow-hidden">
            <div className="bg-muted px-6 py-4 flex justify-between items-center border-b">
              <div>
                <h3 className="font-semibold text-lg">
                  <Link to="/jobs/$jobIdOrSlug" params={{ jobIdOrSlug: app.job.slug }} className="hover:underline">
                    {app.job.title}
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground">{app.job.company.name}</p>
              </div>
              <Badge variant={app.status === 'REJECTED' ? 'destructive' : app.status === 'PASSED' ? 'default' : 'secondary'}>
                {app.status}
              </Badge>
            </div>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <ApplicationHistory history={app.history} />
              </div>
              <div>
                <h4 className="font-semibold text-md mb-4">Interviews</h4>
                <InterviewList applicationId={app.id} isRecruiter={false} />
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
