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
