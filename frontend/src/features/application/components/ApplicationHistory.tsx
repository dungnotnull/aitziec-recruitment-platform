import React from 'react';
import type { ApplicationStatusEvent } from '@/api/types';
import { Card, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';

interface ApplicationHistoryProps {
  history: ApplicationStatusEvent[];
}

export const ApplicationHistory: React.FC<ApplicationHistoryProps> = ({ history }) => {
  if (!history || history.length === 0) return null;

  // Sort history descending by occurredAt
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPLIED': return 'secondary';
      case 'REVIEWING': return 'default';
      case 'INTERVIEWING': return 'default';
      case 'PASSED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-semibold text-lg mb-6">Application History</h3>

        <div className="space-y-6">
          {sortedHistory.map((event, index) => (
            <div key={event.id} className="relative pl-6 pb-2">
              {/* Timeline line */}
              {index !== sortedHistory.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-border" />
              )}
              {/* Timeline dot */}
              <div className="absolute left-2 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />

              <div>
                <div className="flex items-center gap-3">
                  <Badge variant={getStatusColor(event.toStatus)}>{event.toStatus}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleString()}
                  </span>
                </div>
                {event.reason && (
                  <p className="mt-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                    {event.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
