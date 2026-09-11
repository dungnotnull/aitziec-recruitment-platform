import React, { useState, useRef } from 'react';
import { useSubmitApplication } from '../hooks/useApplication';
import { useCvs, useUploadCv } from '@/features/cv/hooks/useCv';
import { Button } from '@/shared/ui/button';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { UploadCloud, FileText, CheckCircle2, FileUp, Sparkles, AlertCircle } from 'lucide-react';

interface ApplyFormProps {
  jobId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ApplyForm: React.FC<ApplyFormProps> = ({ jobId, onSuccess, onCancel }) => {
  const [selectedCvId, setSelectedCvId] = useState<string>('');
  const [candidateNote, setCandidateNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitApplication = useSubmitApplication();
  const uploadCvMutation = useUploadCv();
  const { data: cvsData, isLoading: isLoadingCvs } = useCvs();
  const cvs = cvsData?.data || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCvId) {
      setError('Please select or upload a CV to apply with.');
      return;
    }
    setError(null);

    submitApplication.mutate(
      {
        jobId,
        data: { cvId: selectedCvId, candidateNote: candidateNote || null },
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess,
        onError: (err: any) => {
          setError(err.response?.data?.error?.message || 'Failed to submit application.');
        }
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      uploadCvMutation.mutate(file, {
        onSuccess: (data) => {
          setSelectedCvId(data.data.cv.id);
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (err: any) => {
          setError(err.response?.data?.error?.message || 'Failed to upload CV.');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      });
    }
  };

  if (isLoadingCvs) {
    return (
      <div className="space-y-6 py-4 animate-pulse">
        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        <div className="flex justify-end gap-4 mt-8">
          <div className="h-12 w-24 bg-slate-100 dark:bg-slate-800 rounded-full" />
          <div className="h-12 w-32 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 py-2">
      {error && (
        <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900 shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Select Existing CV Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Choose Your CV</h3>
        </div>

        {cvs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cvs.map(cv => (
              <label
                key={cv.id}
                onClick={() => setSelectedCvId(cv.id)}
                className={`group relative flex flex-col p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 ease-out hover:shadow-md ${
                  selectedCvId === cv.id
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                <input 
                  type="radio" 
                  name="cvSelect" 
                  className="sr-only" 
                  checked={selectedCvId === cv.id}
                  onChange={() => setSelectedCvId(cv.id)} 
                />
                <div className="flex items-start justify-between mb-3">
                  <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedCvId === cv.id ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-700 group-hover:border-blue-400'
                  }`}>
                    {selectedCvId === cv.id && <div className="w-2.5 h-2.5 rounded-full bg-white scale-in" />}
                  </div>
                  {selectedCvId === cv.id && (
                    <span className="flex items-center text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider animate-in fade-in zoom-in">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Selected
                    </span>
                  )}
                </div>
                
                <div className="mt-auto">
                  <p className="font-semibold text-slate-900 dark:text-white text-base truncate pr-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {cv.originalFileName}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {cv.isDefault && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Default
                      </span>
                    )}
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {cv.processingStatus === 'READY' ? 'Ready to use' : <span className="text-amber-500 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Processing...</span>}
                    </span>
                  </div>
                </div>
                
                {/* Decorative background glow when selected */}
                {selectedCvId === cv.id && (
                  <div className="absolute inset-0 rounded-2xl ring-4 ring-blue-500/10 pointer-events-none" />
                )}
              </label>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
            <div className="p-3 bg-white dark:bg-slate-800 shadow-sm rounded-xl mb-3">
              <FileUp className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-center">No CVs found in your profile</p>
            <p className="text-sm text-slate-500 mt-1 text-center max-w-sm">Upload a new CV below to apply for this job.</p>
          </div>
        )}

        {/* Upload New CV Option */}
        <div className="pt-2">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={uploadCvMutation.isPending}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadCvMutation.isPending}
            className={`w-full group relative overflow-hidden flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-2xl border-2 border-dashed transition-all duration-300 ${
              uploadCvMutation.isPending 
                ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/20 cursor-wait' 
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 hover:shadow-inner'
            }`}
          >
            <div className={`p-4 rounded-2xl transition-all duration-500 ${
              uploadCvMutation.isPending 
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 animate-pulse' 
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover:scale-110 group-hover:bg-blue-100 group-hover:text-blue-600 dark:group-hover:bg-blue-900 dark:group-hover:text-blue-400 shadow-sm'
            }`}>
              <UploadCloud className={`w-8 h-8 ${uploadCvMutation.isPending ? 'animate-bounce' : ''}`} />
            </div>
            
            <div className="text-center z-10">
              <p className={`text-base font-semibold transition-colors ${
                uploadCvMutation.isPending ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300'
              }`}>
                {uploadCvMutation.isPending ? 'Uploading your CV...' : 'Upload a new CV from your device'}
              </p>
              {!uploadCvMutation.isPending && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                  Supported formats: PDF, DOC, DOCX (Max 5MB)
                </p>
              )}
            </div>
            
            {/* Background subtle gradient on hover */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-50/50 dark:to-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </button>
        </div>
      </div>

      {/* Message Section */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Label htmlFor="candidateNote" className="text-base font-semibold text-slate-900 dark:text-white">
            Message to Recruiter <span className="text-slate-400 font-normal ml-1">(Optional)</span>
          </Label>
        </div>
        <div className="relative group">
          <textarea
            id="candidateNote"
            value={candidateNote}
            onChange={(e) => setCandidateNote(e.target.value)}
            placeholder="Introduce yourself, highlight specific experiences, or explain why you're a great fit for this role..."
            className="w-full min-h-[140px] rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-5 py-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm group-hover:border-slate-300 dark:group-hover:border-slate-700"
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-slate-200 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left max-w-xs leading-relaxed">
          By submitting, you agree to share your profile and CV with the employer.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel} 
              disabled={submitApplication.isPending}
              className="h-12 px-6 rounded-xl border-2 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold"
            >
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={submitApplication.isPending || (!selectedCvId && cvs.length === 0)}
            className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all font-semibold text-base w-full sm:w-auto disabled:opacity-50 disabled:hover:shadow-none"
          >
            {submitApplication.isPending ? (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 animate-pulse" />
                Submitting...
              </span>
            ) : (
              'Submit Application'
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};
