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
  | "EMAIL_ALREADY_EXISTS"
  | "INVALID_CREDENTIALS"
  | "INVALID_REFRESH_TOKEN"
  | "REFRESH_TOKEN_REUSED"
  | "ACCOUNT_SUSPENDED"
  | "RATE_LIMITED";

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
  status: string;
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
  role: string;
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

export type PaginatedResponse<T> = SuccessResponse<T> & {
  meta: PaginationMeta;
};
