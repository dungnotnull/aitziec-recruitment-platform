# 💼 AITZiec — AI-Powered Recruitment Platform

> A modern recruitment & job board platform inspired by [ITViec](https://itviec.com/) and [VietnamWorks](https://www.vietnamworks.com/), built to explore **AI Engineering, Backend Architecture, Search, Event-Driven Systems, and scalable software design**.

## ✨ Overview

**ITZiec** is a full-stack recruitment platform connecting **Candidates, HRs, and Administrators**.

Beyond basic job-board functionality, the project focuses on production-oriented engineering concepts such as:

* 🤖 AI-powered CV screening
* 🎯 CV ↔ JD matching
* 🧠 AI CV gap analysis & improvement suggestions
* 🔎 PostgreSQL full-text search
* ⚡ Event-driven architecture
* 📨 Background jobs & asynchronous processing
* 📄 PDF processing & S3-compatible storage
* 📬 Local email infrastructure
* 💡 Job recommendation
* 🔐 Authentication & RBAC
* 📊 Audit logs & observability

The project is also designed as a **learning platform** for exploring modern backend and AI technologies through a realistic product.

---

## 🚀 Features

### 👤 Candidate

* Create and manage candidate profile
* Upload and manage CV PDF
* Manage skills and experience
* Search and filter jobs
* Save/bookmark jobs
* Apply for jobs
* Track application status
* View application history
* Receive application notifications
* Receive AI-powered job recommendations
* Analyze CV compatibility with a specific JD
* Get AI suggestions to improve CV when requirements are not met

### 🏢 HR / Recruiter

* Create and manage company profile
* Create, edit and publish job postings
* Define:

  * Job title
  * Description
  * Requirements
  * Tech stack
  * Salary range
  * Location
  * Experience level
  * Employment type
  * Application deadline
* View applicants
* Manage recruitment pipeline
* Schedule interviews
* Add interview notes and feedback
* Update application status
* Trigger automatic candidate notifications
* Use AI-powered CV screening to identify relevant candidates

### 🔄 Recruitment Pipeline

Applications follow a controlled state machine:

```text
Applied
   ↓
Reviewing
   ↓
Interviewing
   ↓
 ┌───────────────┐
 ↓               ↓
Passed        Rejected
```

Invalid state transitions are rejected by the backend.

---

## 🤖 AI Features

### 1. AI CV Screening

Gemini analyzes candidate CVs against job requirements.

```text
CV PDF
  ↓
Text Extraction
  ↓
Gemini
  ↓
Structured CV Profile
  ↓
Skills / Experience / Keywords
  ↓
CV ↔ JD Matching
  ↓
Match Score
```

The system can help HR identify candidates who satisfy important job requirements.

---

### 2. 🎯 CV ↔ JD Matching

The matching engine evaluates multiple dimensions:

* Skills
* Technical stack
* Experience
* Job requirements
* Keywords
* Seniority
* Relevant background

Example:

```text
Overall Match       82%
────────────────────────────
Technical Skills    91%
Experience          80%
Requirements        85%
Keywords            76%
```

---

### 3. 🧠 AI CV Gap Analysis

When a candidate does not sufficiently match a JD, ITZiec identifies the gaps and provides actionable suggestions.

```text
Match Score: 62%

Missing Skills
  ├── PostgreSQL
  └── Docker

Missing Requirements
  └── 3+ years Node.js experience

Missing Keywords
  └── Microservices
  └── REST API

Suggested Improvements
  ├── Add relevant PostgreSQL experience
  ├── Highlight Docker projects
  ├── Quantify Node.js experience
  └── Mention relevant microservice work
```

The goal is not simply to reject a candidate, but to provide useful feedback on **how the CV could better communicate relevant experience**.

---

### 4. 🔎 Natural Language Job Search

Candidates can search using natural language.

Example:

```text
Find me a mid-level Node.js backend
job in Ho Chi Minh City with salary
above 25M.
```

The system converts the natural-language query into structured search filters:

```json
{
  "role": "Backend Developer",
  "skills": ["Node.js"],
  "experienceLevel": "Mid-level",
  "location": "Ho Chi Minh City",
  "minSalary": 25000000
}
```

---

### 5. 💡 Job Recommendation

The recommendation engine considers:

* Candidate skills
* Experience
* Technology stack
* Profile
* Saved jobs
* Search behavior
* Application history

to calculate job relevance.

---

## 🔎 Search Engine

ITZiec uses **PostgreSQL Full-Text Search** rather than relying only on simple SQL `LIKE` queries.

Searchable content includes:

* Job title
* Job description
* Requirements
* Tech stack
* Skills
* Location

Additional ranking factors can include:

```text
Search Relevance
        +
Skill Match
        +
Experience Match
        +
Salary Match
        +
Location Match
        +
Job Freshness
        ↓
Final Ranking Score
```

---

## 📨 Event-Driven Email System

Application-related actions generate domain events.

Example:

```text
Candidate submits application
            ↓
   ApplicationSubmitted
            ↓
        BullMQ Queue
            ↓
      Email Worker
            ↓
       Nodemailer
            ↓
   ┌────────┴────────┐
   ↓                 ↓
Development       Production
   ↓                 ↓
 Mailpit          SMTP Provider
```

### Development

Emails are captured by **Mailpit** instead of being sent to real users.

```text
SMTP:   localhost:1025
Web UI: localhost:8025
```

This allows the entire email workflow to be tested locally for free.

### Production

The Email Service abstraction can be configured to use a real SMTP provider without changing the application business logic.

---

## ⚡ Background Jobs

Redis + BullMQ are used for asynchronous workloads such as:

* 📧 Email sending
* 🤖 AI CV analysis
* 📄 PDF processing
* 🎯 CV ↔ JD matching
* 🔔 Notifications

The queue system can support:

* Retry
* Exponential backoff
* Failed job handling
* Job status tracking
* Worker processing

---

## 📄 File Processing

Candidate CVs are uploaded as PDF files.

```text
Upload CV
   ↓
File Validation
   ↓
MinIO
   ↓
PDF Text Extraction
   ↓
AI Processing
   ↓
Structured CV Data
```

MinIO provides an S3-compatible object storage layer for local development.

---

## 🏗️ Architecture

High-level architecture:

```text
┌───────────────────────────────────────────┐
│                 Frontend                  │
│              Vue / React                  │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│              NestJS API                   │
│                                           │
│ Auth │ Jobs │ Applications │ AI │ Search │
└──────┬────────────┬────────────┬──────────┘
       │            │            │
       ▼            ▼            ▼
 PostgreSQL       Redis        MinIO
       │            │            │
       │            ▼            │
       │         BullMQ          │
       │            │            │
       │            ▼            │
       │      Background Workers │
       │            │            │
       │            ▼            │
       │         Gemini          │
       │                         │
       └───────────┬─────────────┘
                   ▼
             Email Service
                   │
          ┌────────┴────────┐
          ▼                 ▼
       Mailpit          SMTP Provider
```

---

## 🧩 Tech Stack

| Category          | Technology                  |
| ----------------- | --------------------------- |
| Backend           | NestJS / Node.js            |
| Frontend          | Vue / React                 |
| Database          | PostgreSQL                  |
| Search            | PostgreSQL Full-Text Search |
| Cache             | Redis                       |
| Queue             | BullMQ                      |
| Object Storage    | MinIO                       |
| Email             | Nodemailer                  |
| Local Email       | Mailpit                     |
| AI                | Gemini API                  |
| API Documentation | Swagger / OpenAPI           |
| Authentication    | JWT                         |
| Authorization     | RBAC                        |
| Containerization  | Docker / Docker Compose     |
| Testing           | Unit / Integration / E2E    |
| CI/CD             | GitHub Actions              |

---

## 🗃️ Core Data Model

Main entities:

```text
User
 ├── Candidate
 └── HR

Company
 └── Jobs
       └── Applications
              └── Interviews

Candidate
 ├── CV
 ├── Skills
 ├── Saved Jobs
 └── Applications

Application
 ├── Candidate
 ├── Job
 └── Interviews

AuditLog
```

Potential database tables:

```text
users
companies
jobs
skills
candidate_skills
cvs
applications
application_events
interviews
saved_jobs
notifications
audit_logs
```

---

## 🔐 Security

The platform explores common production API security practices:

* JWT authentication
* Refresh tokens
* Role-Based Access Control
* Request validation
* Authorization guards
* Rate limiting
* File type validation
* MIME-type checking
* Upload size limits
* Secure resource access
* API error handling

Roles:

```text
Admin
  │
  ├── User Management
  ├── Job Moderation
  └── System Management

HR
  │
  ├── Company
  ├── Jobs
  └── Applications

Candidate
  │
  ├── Profile
  ├── CV
  ├── Job Search
  └── Applications
```

---

## 📊 Audit & Observability

Important system actions are recorded through an audit log.

Examples:

```text
JOB_CREATED
JOB_UPDATED
JOB_PUBLISHED
APPLICATION_SUBMITTED
APPLICATION_STATUS_CHANGED
INTERVIEW_SCHEDULED
CV_ANALYZED
USER_ROLE_CHANGED
```

The system also explores:

* Structured logging
* Request tracing
* Health checks
* Queue monitoring
* Error tracking

---

## 🧪 Testing

Testing areas include:

### Unit Tests

* Business logic
* Matching algorithms
* State transitions
* Search ranking
* AI response validation

### Integration Tests

* PostgreSQL
* Redis
* MinIO
* Email service
* Queue workers

### E2E Tests

Example:

```text
Register
   ↓
Create Profile
   ↓
Upload CV
   ↓
Search Job
   ↓
Apply
   ↓
HR Reviews Application
   ↓
Interview
   ↓
Passed / Rejected
```

---

## 🐳 Local Development

The development environment is designed to run with Docker Compose.

Expected infrastructure:

```text
PostgreSQL
Redis
MinIO
Mailpit
```

Example:

```bash
docker compose up -d
```

Then run the application:

```bash
npm install
npm run start:dev
```

Typical local services:

| Service        |   Port |
| -------------- | -----: |
| API            | `3000` |
| PostgreSQL     | `5432` |
| Redis          | `6379` |
| MinIO          | `9000` |
| MinIO Console  | `9001` |
| Mailpit SMTP   | `1025` |
| Mailpit Web UI | `8025` |

> Ports may be changed depending on the local environment.

---

## 🔑 Environment Variables

Example:

```env
NODE_ENV=development

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/itziec

REDIS_HOST=localhost
REDIS_PORT=6379

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_FROM=no-reply@itziec.local

GEMINI_API_KEY=your_api_key
```

Never commit real credentials or API keys to the repository.

---

## 💡 Project Philosophy

ITZiec is not intended to be just another CRUD-based job board.

The project focuses on building a realistic system where different engineering concepts interact:

```text
                    ITZiec
                       │
       ┌───────────────┼───────────────┐
       │               │               │
    Product          Backend           AI
       │               │               │
       ▼               ▼               ▼
 Job Search       Event-driven     CV Screening
 Applications     Background Jobs  JD Matching
 Recruitment      PostgreSQL       Gap Analysis
 Notifications    Redis/BullMQ     Recommendations
       │               │               │
       └───────────────┼───────────────┘
                       ▼
              Production-oriented
                System Design
```

The feature set is continuously refined through brainstorming, real-world product research, and AI-assisted ideation, with the goal of maximizing both **practical product value** and **technical learning opportunities**.

---

## 📚 Inspiration

The product experience is inspired by established recruitment platforms such as:

* [ITviec](https://itviec.com/)
* [VietnamWorks](https://www.vietnamworks.com/)

The implementation is an independent project created for learning, experimentation, and portfolio purposes.

---

## 📄 License

This project is intended for educational and portfolio purposes.

Add your preferred open-source license here if the repository will be publicly distributed.
