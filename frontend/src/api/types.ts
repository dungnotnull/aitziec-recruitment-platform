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
  | "CV_RETRY_EXHAUSTED"
  | "INVITATION_NOT_FOUND"
  | "INVITATION_EXPIRED"
  | "INVITATION_ALREADY_ACCEPTED"
  | "INVITATION_REVOKED"
  | "INVITATION_EMAIL_MISMATCH"
  | "INVITATION_ALREADY_PENDING"
  | "RECOMMENDATION_OPTED_OUT"
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

export type RegisterRequest = {
  email: string;
  password: string;
  role: "CANDIDATE" | "HR";
};

export type LoginRequest = {
  email: string;
  password: string;
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

export type UpdateCandidateProfileRequest = UpdateCandidateProfileInput;

// --- Company Module Types ---

export type CompanyStatus = "ACTIVE" | "SUSPENDED";
export type CompanyMemberRole = "OWNER" | "RECRUITER";

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

export type CallerCompanyMembership = {
  membership: {
    id: string;
    role: CompanyMemberRole;
    createdAt: string;
  };
  company: Company;
};

export type AddCompanyMemberInput = {
  userEmail: string;
  role?: "RECRUITER";
};

export type PageInfo = {
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
};

export type PaginationMeta = {
  page: PageInfo;
  optedOut?: boolean;
  message?: string;
  profileRequired?: boolean;
  unreadCount?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta & { requestId?: string };
};

export type CollectionResponse<T> = PaginatedResponse<T>;

export type CompanyInvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export type CompanyInvitation = {
  id: string;
  companyId: string;
  email: string;
  maskedEmail?: string;
  role: CompanyMemberRole;
  status: CompanyInvitationStatus;
  expiresAt: string;
  createdAt: string;
};

export type UploadCompanyLogoResponse = {
  logoUrl: string;
  version: number;
};

export type HrInvitationCompanySummary = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
};

export type HrInvitationItem = {
  id: string;
  company: HrInvitationCompanySummary;
  role: CompanyMemberRole;
  status: CompanyInvitationStatus;
  expiresAt: string;
  createdAt: string;
};

export type HrProfile = {
  id: string;
  userId: string;
  fullName?: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type UpdateHrProfileInput = {
  expectedVersion?: number;
  fullName?: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
};

export type UpdateHrProfileRequest = UpdateHrProfileInput;

// --- Job Module Types ---

export type JobStatus = "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "UNPUBLISHED" | "CLOSED" | "EXPIRED";
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
  creatorId?: string | null;
  creatorName?: string | null;
  creatorEmail?: string | null;
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

export type ApproveJobRequest = {
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

export type SavedJobCheck = {
  isSaved: boolean;
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

export type ApplicationStatus =
  | "APPLIED"
  | "REVIEWING"
  | "INTERVIEWING"
  | "PASSED"
  | "REJECTED"
  | "OFFERED"
  | "HIRED";

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

export type AiAnalysisType = "CV_PROFILE" | "CV_JOB_MATCH" | "CV_GAP_ANALYSIS" | "CV_JOB_ANALYSIS";
export type NotificationType =
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_STATUS_CHANGED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_RESCHEDULED"
  | "INTERVIEW_CANCELLED"
  | "APPLICATION_OUTCOME"
  | "COMPANY_INVITATION"
  | "COMPANY_INVITATION_CREATED"
  | "COMPANY_MEMBER_ADDED"
  | "JOB_PENDING_APPROVAL";

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

export type RecommendedJob = {
  job: Job;
  score: number;
  reasonCodes: string[];
  evidence: string[];
  limitations: string[];
};

export type RecommendationPreference = {
  id?: string;
  userId?: string;
  enabled: boolean;
  consentPolicyVersion: string;
  consentedAt: string;
  updatedAt?: string;
  version: number;
};

export type UpdateRecommendationPreferenceRequest = {
  enabled: boolean;
  consentPolicyVersion: string;
  expectedVersion: number;
};

// --- Notification ---

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
  userId?: string;
  resourceType?: string | null;
  resourceId?: string | null;
  resource?: { type: string; id: string } | null;
};

export type NotificationPageResponse = PaginatedResponse<Notification> & {
  meta: PaginatedResponse<Notification>["meta"] & {
    total?: number;
    unreadCount?: number;
  };
};

// --- Skill Catalog ---

export type SkillCatalogItem = {
  id: string;
  name: string;
  aliases: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// --- Admin ---

export type AdminCompany = Company & {
  memberCount?: number;
  jobCount?: number;
};

export type AdminJob = Job & {
  company: Pick<Company, "id" | "name" | "slug" | "status">;
};

export type AdminApplicationSummary = {
  id: string;
  status: ApplicationStatus;
  version: number;
  submittedAt: string;
  updatedAt: string;
  candidate: {
    id: string;
    fullName: string;
    headline: string | null;
    skills: string[];
  };
  job: {
    id: string;
    title: string;
    slug: string;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  };
};

export type AdminApplicationDetail = AdminApplicationSummary & {
  history: ApplicationStatusEvent[];
};

export type ModerateApplicationRequest = {
  targetStatus: ApplicationStatus;
  reason: string;
  expectedVersion: number;
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
