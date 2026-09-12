import { BadRequestException } from '@nestjs/common';

export const SUPPORTED_EVENT_VERSION = 1;

export interface ApplicationSubmittedPayload {
  applicationId: string;
  candidateId: string;
  candidateUserId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  submittedAt: string;
}

export interface ApplicationStatusChangedPayload {
  applicationId: string;
  candidateId: string;
  candidateUserId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string;
}

export interface InterviewScheduledPayload {
  interviewId: string;
  applicationId: string;
  candidateUserId: string;
  jobTitle: string;
  companyName: string;
  startsAt: string;
  endsAt: string;
  locationOrMeetingUrl: string;
  candidateInstructions?: string | null;
}

export interface InterviewRescheduledPayload {
  interviewId: string;
  applicationId: string;
  candidateUserId: string;
  jobTitle: string;
  companyName: string;
  startsAt: string;
  endsAt: string;
  locationOrMeetingUrl: string;
  candidateInstructions?: string | null;
}

export interface InterviewCancelledPayload {
  interviewId: string;
  applicationId: string;
  candidateUserId: string;
  jobTitle: string;
  companyName: string;
  reason?: string | null;
}

export interface CvUploadedPayload {
  cvId: string;
  candidateId: string;
  sizeBytes: number;
  checksumSha256: string;
  operationId: string;
}

export interface CvExtractionRetryQueuedPayload {
  cvId: string;
  candidateId: string;
  operationId: string;
  attempt: number;
}

export interface CvTextExtractedPayload {
  cvId: string;
  candidateId?: string;
  operationId?: string;
  extractedLength?: number;
}

export interface CvExtractionSucceededPayload {
  cvId: string;
  candidateProfileId: string;
  candidateUserId: string;
}

export interface CvExtractionFailedPayload {
  cvId: string;
  candidateProfileId: string;
  candidateUserId: string;
  failureCode: string;
}

export interface CompanyMemberAddedPayload {
  companyId: string;
  companyName: string;
  userId: string;
  role: string;
  addedById: string;
}

export interface CompanyInvitationCreatedPayload {
  companyId: string;
  companyName: string;
  email: string;
  role: string;
  invitedById: string;
  invitationId: string;
}

export interface CvJobAnalysisQueuedPayload {
  operationId: string;
  cvId: string;
  jobId: string;
  analyses: string[];
}

export interface AiAnalysisCompletedPayload {
  analysisId: string;
  operationId: string;
  cvId: string;
  jobId: string;
  overallScore: number;
}

export interface DomainEventPayloadMap {
  ApplicationSubmitted: ApplicationSubmittedPayload;
  ApplicationStatusChanged: ApplicationStatusChangedPayload;
  InterviewScheduled: InterviewScheduledPayload;
  InterviewRescheduled: InterviewRescheduledPayload;
  InterviewCancelled: InterviewCancelledPayload;
  CvUploaded: CvUploadedPayload;
  CvExtractionRetryQueued: CvExtractionRetryQueuedPayload;
  CvTextExtracted: CvTextExtractedPayload;
  CvExtractionSucceeded: CvExtractionSucceededPayload;
  CvExtractionFailed: CvExtractionFailedPayload;
  CompanyMemberAdded: CompanyMemberAddedPayload;
  CompanyInvitationCreated: CompanyInvitationCreatedPayload;
  CvJobAnalysisQueued: CvJobAnalysisQueuedPayload;
  AiAnalysisCompleted: AiAnalysisCompletedPayload;
}

export type DomainEventName = keyof DomainEventPayloadMap;

/**
 * Validates that an event version is supported.
 */
export function validateEventVersion(version: number): void {
  if (version !== SUPPORTED_EVENT_VERSION) {
    throw new BadRequestException(
      `Unsupported event version: ${version}. Only version ${SUPPORTED_EVENT_VERSION} is supported.`,
    );
  }
}

/**
 * Validates that safe payload fields are present and prohibited private fields are excluded.
 */
const PROHIBITED_FIELDS = [
  'note',
  'notes',
  'recruiterPrivateNotes',
  'recruiterFeedback',
  'token',
  'password',
  'secret',
  'storageKey',
  'fileBuffer',
  'rawText',
  'extractedText',
  'phone',
];

export function validateSafePayload(payload: Record<string, unknown>): void {
  for (const key of Object.keys(payload)) {
    if (PROHIBITED_FIELDS.includes(key)) {
      throw new BadRequestException(
        `Domain event payload contains prohibited private field: "${key}".`,
      );
    }
  }
}
