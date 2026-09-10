import React, { useState, useRef } from 'react';
import { useUploadCv } from '../hooks/useCv';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { getApiErrorDetails } from '@/shared/lib/api-error';

type CvUploaderProps = {
  onOperationCreated?: (operationId: string) => void;
};

export const CvUploader: React.FC<CvUploaderProps> = ({ onOperationCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCv = useUploadCv();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      setFile(null);
      return;
    }

    // 10 MiB limit
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      setFile(null);
      return;
    }

    setError(null);
    setFile(selectedFile);
  };

  const handleUpload = () => {
    if (!file) return;

    uploadCv.mutate(file, {
      onSuccess: (response) => {
        onOperationCreated?.(response.data.operation.id);
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      onError: (uploadError) => {
        setError(getApiErrorDetails(uploadError).message);
      }
    });
  };

  return (
    <div className="bg-card p-6 rounded-lg border shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Upload New CV</h3>

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="cv-pdf-file" className="mb-2 block text-sm font-semibold text-ink">PDF file</label>
          <input
            id="cv-pdf-file"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-primary file:text-primary-foreground
              hover:file:bg-primary/90"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Max size: 10MB. Format: PDF only.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || uploadCv.isPending}
          className="w-full md:w-auto self-start"
        >
          {uploadCv.isPending ? 'Uploading…' : 'Upload CV'}
        </Button>
      </div>
    </div>
  );
};
