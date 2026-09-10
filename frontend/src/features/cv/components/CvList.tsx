import React from 'react';
import { useCvs, useSetDefaultCv, useDeleteCv, useDownloadCv } from '../hooks/useCv';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import type { Cv } from '@/api/types';
import { Alert, AlertDescription } from '@/shared/ui/alert';

export const CvList: React.FC = () => {
  const { data, isLoading, isError, error } = useCvs();
  const setDefaultCv = useSetDefaultCv();
  const deleteCv = useDeleteCv();
  const downloadCv = useDownloadCv();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error?.message || 'Failed to load CVs.'}</AlertDescription>
      </Alert>
    );
  }

  const cvs = data?.data || [];

  if (cvs.length === 0) {
    return (
      <div className="text-center py-8 border rounded-lg border-dashed">
        <p className="text-muted-foreground">You haven't uploaded any CVs yet.</p>
      </div>
    );
  }

  const handleSetDefault = (cv: Cv) => {
    setDefaultCv.mutate({ cvId: cv.id, expectedVersion: cv.version });
  };

  const handleDelete = (cv: Cv) => {
    if (confirm('Are you sure you want to delete this CV?')) {
      deleteCv.mutate(cv.id);
    }
  };

  const handleDownload = (cv: Cv) => {
    downloadCv.mutate(cv.id, {
      onSuccess: (data) => {
        window.open(data.data.url, '_blank');
      }
    });
  };

  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY': return 'default';
      case 'FAILED': return 'destructive';
      case 'EXTRACTING': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      {cvs.map((cv) => (
        <Card key={cv.id} className={cv.isDefault ? 'border-primary shadow-sm' : ''}>
          <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-lg">{cv.originalFileName}</h4>
                {cv.isDefault && <Badge variant="default">Default</Badge>}
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex gap-4">
                <span>{formatSize(cv.sizeBytes)}</span>
                <span>Uploaded: {new Date(cv.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="font-medium">Status:</span>
                <Badge variant={getStatusColor(cv.processingStatus)}>{cv.processingStatus}</Badge>
                {cv.failureCode && (
                  <span className="text-destructive text-xs ml-2">Error: {cv.failureCode}</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(cv)}
                disabled={downloadCv.isPending && downloadCv.variables === cv.id}
              >
                Download
              </Button>
              {!cv.isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetDefault(cv)}
                  disabled={setDefaultCv.isPending}
                >
                  Set Default
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(cv)}
                disabled={deleteCv.isPending || cv.isDefault}
                title={cv.isDefault ? "Cannot delete the default CV" : ""}
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
