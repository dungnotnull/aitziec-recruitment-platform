# ITZiec — Original Requirements Brief

ITZiec is an independent recruitment and job-board platform inspired by ITviec and VietnamWorks. The brief defines the product ambition and learning focus; it does not imply that the listed features are already implemented.

## Core features

- **Job management:** HR creates, edits, publishes/unpublishes, opens/closes, and manages job postings.
- **Candidate management:** candidates create profiles, upload CV PDFs, and manage skills and experience.
- **Job discovery:** search by title, technology, skill, salary range, location, experience level, and employment type.
- **Job details:** show description, requirements, tech stack, salary, location, company, and deadline.
- **Applications:** candidates apply; HR manages applicants per job.
- **Recruitment pipeline:** `Applied → Reviewing → Interviewing → Passed/Rejected`, with validation for every transition.
- **Interviews:** HR schedules interviews, updates notes/feedback, and notifies candidates.
- **Application tracking:** candidates see application history and current status.
- **Saved jobs:** candidates bookmark and manage jobs of interest.
- **Email notifications:** notify on application submission, status changes, interview invitations, and outcomes.
- **Local email infrastructure:** use Nodemailer and Mailpit locally without sending real email.
- **AI CV screening:** Gemini analyzes CVs and job descriptions to estimate fit and highlight important unmet requirements.
- **AI CV gap analysis:** identify missing skills, requirements, and keywords, then suggest practical improvements.
- **AI job recommendations:** recommend jobs using skills, experience, tech stack, profile, and interaction history.
- **Natural-language search:** translate queries such as “Backend Node.js in HCM for Mid-level above 25M” into structured filters.
- **Admin dashboard:** manage users, companies, jobs, applications, and moderation.
- **Audit log:** record job changes, application transitions, interview scheduling, and administrative actions.

## Technical focus

- Relational PostgreSQL design for users, companies, jobs, applications, interviews, skills, CVs, and audit logs.
- PostgreSQL full-text search and indexes for job title, description, technologies, and keywords.
- Search ranking using relevance, technology/skill match, experience, salary, location, and freshness.
- Structured filtering, sorting, and pagination combined with full-text search.
- CV upload, validation, metadata, preview, and S3-compatible MinIO storage.
- PDF text extraction for AI analysis and CV/JD matching.
- Transactional application state machine with concurrency protection.
- Domain events such as `ApplicationSubmitted`, `ApplicationStatusChanged`, and `InterviewScheduled`.
- Redis + BullMQ for email, AI CV screening, PDF processing, and asynchronous tasks.
- Retry, exponential backoff, job status tracking, and failed-job handling.
- Gemini integration with structured JSON output and schema validation before persistence/use.
- AI evaluation through test cases/datasets for accuracy and consistency.
- Recommendation scoring from profile, skills, interactions, and application history.
- Natural-language query parsing into validated search filters.
- Redis caching for popular jobs, frequently accessed data, and selected search results.
- JWT authentication, refresh sessions, RBAC, input validation, rate limiting, MIME/type checks, and upload limits.
- REST API with DTO validation, standardized errors, pagination, filtering, sorting, and Swagger/OpenAPI.
- Structured logging, request tracing, health checks, queue monitoring, and error tracking.
- Dockerized local development and CI/CD for linting, tests, build, and deployment.
- Unit, integration, and E2E tests for authentication, search, applications, uploads, AI, and email.

## Target AI workflow

```text
CV PDF
  ↓
PDF text extraction
  ↓
Gemini → structured CV profile
  ↓
JD → matching engine → match score
                         ├─ good match → recommendation
                         └─ low match  → gap analysis → improvement suggestions
```

AI output is advisory, schema-validated, observable, and must not independently reject or advance an application.

## Target email workflow

```text
Candidate submits application
  ↓
ApplicationSubmitted
  ↓
BullMQ queue → email worker → Nodemailer
                           ├─ development: Mailpit
                           └─ production: SMTP provider
```

The email service is an abstraction so business logic does not depend on a specific SMTP provider.

## Learning goals

- Full-stack architecture and modular backend design.
- Advanced PostgreSQL querying, indexes, and full-text search.
- Transactional state machines and data integrity.
- Event-driven architecture and reliable background jobs.
- S3-compatible storage and PDF processing.
- Structured LLM integration, evaluation, matching, and recommendations.
- Authentication, authorization, security, testing, observability, Docker, and CI/CD.

## Product principles

- Build practical recruitment value while using realistic engineering boundaries.
- Treat requirements, API contracts, and changelog entries as explicit project memory.
- Prefer transparent, explainable assistance over unreviewable automated hiring decisions.
- Keep local development reproducible and free-tier friendly.

