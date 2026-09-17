import React, { useState, useRef } from 'react';
import { useUploadCv } from '../hooks/useCv';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { getApiErrorDetails } from '@/shared/lib/api-error';
import { CheckCircle2 } from 'lucide-react';

type CvUploaderProps = {
  onOperationCreated?: (operationId: string) => void;
};

export const CvUploader: React.FC<CvUploaderProps> = ({ onOperationCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCv = useUploadCv();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setSuccessMessage(null);

    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
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

    setSuccessMessage(null);
    setError(null);

    uploadCv.mutate(file, {
      onSuccess: (response) => {
        setSuccessMessage(`CV "${file.name}" uploaded successfully!`);
        onOperationCreated?.(response.data.operation.id);
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      onError: (uploadError) => {
        setSuccessMessage(null);
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
            className="block w-full text-sm text-slate-600 dark:text-slate-300
              rounded-xl border border-border bg-surface px-3.5 py-2.5 cursor-pointer
              transition-all duration-200 shadow-xs
              hover:border-slate-400 dark:hover:border-slate-600
              focus:outline-none focus:ring-2 focus:ring-action/20 focus:border-action
              file:mr-4 file:py-1.5 file:px-4
              file:rounded-lg file:border file:border-border
              file:text-sm file:font-semibold
              file:bg-surface-raised file:text-ink
              hover:file:bg-surface hover:file:border-action-border hover:file:text-action
              active:file:scale-95 file:cursor-pointer file:transition-all file:shadow-xs"
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

        {successMessage && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <AlertDescription>{successMessage}</AlertDescription>
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
