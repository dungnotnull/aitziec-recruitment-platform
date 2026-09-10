export type UserRole = "CANDIDATE" | "HR" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

export type SuccessResponse<T> = {
  data: T;
  meta?: {
    requestId: string;
  };
};

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CURSOR"
  | "AUTHENTICATION_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "ACCESS_TOKEN_EXPIRED"
  | "INVALID_REFRESH_TOKEN"
  | "REFRESH_TOKEN_REUSED"
  | "ACCOUNT_SUSPENDED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "EMAIL_ALREADY_EXISTS"
  | "COMPANY_SLUG_EXISTS"
  | "MEMBERSHIP_ALREADY_EXISTS"
  | "LAST_COMPANY_OWNER"
  | "JOB_NOT_PUBLISHABLE"
  | "JOB_NOT_OPEN"
  | "JOB_DEADLINE_PASSED"
  | "APPLICATION_ALREADY_EXISTS"
  | "INVALID_APPLICATION_TRANSITION"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "PDF_INVALID"
  | "CV_NOT_READY"
  | "INTERVIEW_TIME_INVALID"
  | "INTERVIEW_STATUS_INVALID"
  | "AI_OUTPUT_INVALID"
  | "UPSTREAM_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type FieldError = {
  field: string;
  code: string;
  message: string;
};

export type ErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldError[] | Record<string, unknown>;
    requestId: string;
    timestamp: string;
  };
};

export type UserSummary = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
};

export type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: UserSummary;
};

// --- Candidate Module Types ---

export type CandidateSkill = {
  skillId: string;
  name: string;
  yearsOfExperience: number | null;
};

export type WorkExperience = {
  id: string;
  companyName: string;
  title: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
};

export type CandidateProfile = {
  id: string;
  userId: string;
  fullName: string;
  headline: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  isSearchable: boolean;
  profileCompleteness: number;
  skills: CandidateSkill[];
  experiences: WorkExperience[];
  defaultCvId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type UpdateSkillInput = {
  skillId: string;
  yearsOfExperience?: number | null;
};

export type UpdateExperienceInput = {
  id?: string;
  companyName: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
};

export type UpdateCandidateProfileInput = {
  expectedVersion: number;
  fullName?: string;
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  isSearchable?: boolean;
  skills?: UpdateSkillInput[];
  experiences?: UpdateExperienceInput[];
};

// --- Company Module Types ---

export type Company = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  location: string | null;
  status: CompanyStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateCompanyInput = {
  name: string;
  slug?: string;
  description?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  location?: string | null;
};

export type UpdateCompanyInput = {
  expectedVersion: number;
  name?: string;
  description?: string | null;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  location?: string | null;
};

export type CompanyMembership = {
  id: string;
  companyId: string;
  user: UserSummary;
  role: CompanyMemberRole;
  createdAt: string;
};

export type AddCompanyMemberInput = {
  userEmail: string;
  role?: 'RECRUITER';
};

export type PaginationMeta = {
  page: {
    nextCursor: string | null;
    hasNextPage: boolean;
    limit: number;
  };
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta & { requestId?: string };
};

// --- Job Module Types ---

export type JobStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "CLOSED";
export type ExperienceLevel = "INTERN" | "FRESHER" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "MANAGER";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
export type WorkplaceType = "ONSITE" | "HYBRID" | "REMOTE";

export type Job = {
  id: string;
  company: Pick<Company, "id" | "slug" | "name" | "logoUrl">;
  title: string;
  slug: string;
  description: string;
  requirements: string;
  responsibilities: string | null;
  technologyNames: string[];
  location: string;
  workplaceType: WorkplaceType;
  experienceLevel: ExperienceLevel;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  applicationDeadline: string;
  status: JobStatus;
  publishedAt: string | null;
  closedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateJobRequest = {
  title: string;
  description: string;
  requirements: string;
  responsibilities?: string | null;
  technologyNames: string[];
  location: string;
  workplaceType: WorkplaceType;
  experienceLevel: ExperienceLevel;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  applicationDeadline: string;
};

export type UpdateJobRequest = Partial<CreateJobRequest> & {
  expectedVersion: number;
};

export type JobSearchFilters = {
  q?: string;
  technology?: string[];
  location?: string[];
  experienceLevel?: ExperienceLevel[];
  employmentType?: EmploymentType[];
  workplaceType?: WorkplaceType[];
  companyId?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  publishedAfter?: string;
  sort?: "RELEVANCE" | "NEWEST" | "SALARY_ASC" | "SALARY_DESC";
  cursor?: string;
  limit?: number;
};

// --- CV Module Types ---

export type CvProcessingStatus = "UPLOADED" | "EXTRACTING" | "READY" | "FAILED" | "DELETED";

export type Cv = {
  id: string;
  candidateId: string;
  originalFileName: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  checksumSha256: string;
  processingStatus: CvProcessingStatus;
  failureCode: string | null;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type SignedDownload = {
  url: string;
  expiresAt: string;
};

// --- Application Module Types ---

export type ApplicationStatus = "APPLIED" | "REVIEWING" | "INTERVIEWING" | "PASSED" | "REJECTED";

export type ApplicationStatusEvent = {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  reason: string | null;
  actorId: string;
  occurredAt: string;
};

export type Application = {
  id: string;
  candidateId: string;
  jobId: string;
  submittedCvId: string;
  status: ApplicationStatus;
  candidateNote: string | null;
  version: number;
  submittedAt: string;
  updatedAt: string;
};

export type ApplicationDetail = Application & {
  job: Job;
  candidate: Pick<CandidateProfile, "id" | "fullName" | "headline" | "skills">;
  history: ApplicationStatusEvent[];
};

export type SubmitApplicationRequest = {
  cvId: string;
  candidateNote?: string | null;
};

export type TransitionApplicationRequest = {
  expectedVersion: number;
  targetStatus: ApplicationStatus;
  reason?: string | null;
};

// --- Interview Module Types ---

export type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type Interview = {
  id: string;
  applicationId: string;
  status: InterviewStatus;
  startsAt: string;
  endsAt: string;
  locationOrMeetingUrl: string;
  candidateInstructions: string | null;
  recruiterPrivateNotes?: string | null;
  recruiterFeedback?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateInterviewRequest = {
  startsAt: string;
  endsAt: string;
  locationOrMeetingUrl: string;
  candidateInstructions?: string | null;
  recruiterPrivateNotes?: string | null;
};

export type UpdateInterviewRequest = {
  expectedVersion: number;
  startsAt?: string;
  endsAt?: string;
  locationOrMeetingUrl?: string;
  candidateInstructions?: string | null;
  recruiterPrivateNotes?: string | null;
  recruiterFeedback?: string | null;
};

// --- Operations and AI ---

export type OperationStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export type Operation = {
  id: string;
  type: string;
  status: OperationStatus;
  progressPercent: number | null;
  resultResource: { type: string; id: string } | null;
  failure: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type CompanyStatus = "ACTIVE" | "SUSPENDED";
export type CompanyMemberRole = "OWNER" | "RECRUITER";
export type AiAnalysisType = "CV_JOB_MATCH" | "CV_GAP_ANALYSIS" | "CV_JOB_ANALYSIS";
export type NotificationType =
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_STATUS_CHANGED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_RESCHEDULED"
  | "INTERVIEW_CANCELLED"
  | "APPLICATION_OUTCOME";

export type ScoreComponent = {
  name: "SKILLS" | "EXPERIENCE" | "REQUIREMENTS" | "KEYWORDS";
  score: number;
  weight: number;
  evidence: string[];
};

export type AiAnalysis = {
  id: string;
  type: AiAnalysisType;
  candidateId: string;
  cvId: string;
  jobId: string | null;
  status: "SUCCEEDED" | "FAILED";
  overallScore: number | null;
  components: ScoreComponent[];
  matchedSkills: string[];
  missingSkills: string[];
  unmetRequirements: string[];
  suggestions: string[];
  limitations: string[];
  model: string;
  promptVersion: string;
  schemaVersion: string;
  createdAt: string;
};

export type CreateCvJobAnalysisRequest = {
  cvId: string;
  jobId: string;
  analyses: Array<"CV_JOB_MATCH" | "CV_GAP_ANALYSIS">;
};

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  resource: { type: string; id: string } | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationTransport = Omit<Notification, "resource"> & {
  userId: string;
  resourceType: string | null;
  resourceId: string | null;
};

export type NotificationPageResponse = PaginatedResponse<Notification> & {
  meta: PaginatedResponse<Notification>["meta"] & {
    total: number;
    unreadCount: number;
  };
};

export type AuditLog = {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
};

export type NotificationFilters = { read?: boolean; cursor?: string; limit?: number };
export type AdminUserFilters = { role?: UserRole; status?: UserStatus; cursor?: string; limit?: number };
export type AuditLogFilters = {
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  occurredAfter?: string;
  occurredBefore?: string;
  cursor?: string;
  limit?: number;
};
export type UpdateUserStatusRequest = { status: UserStatus; reason: string };
export type UpdateCompanyStatusRequest = { status: CompanyStatus; reason: string; expectedVersion: number };
export type ModerateJobRequest = { action: "UNPUBLISH" | "CLOSE"; reason: string; expectedVersion: number };
