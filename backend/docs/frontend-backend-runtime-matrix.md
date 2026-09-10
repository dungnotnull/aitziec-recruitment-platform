# Frontend-Backend Runtime Matrix & Security Handshake

**Document Version:** 1.0.0  
**Effective Date:** 2026-09-10  
**Status:** Approved & Verified  
**Applicability:** ITZiec Recruitment Platform (Frontend & Backend Production Integration)

---

## 1. Environment & Origin Topology Matrix

| Environment | Frontend Origin(s) | API Base URL | Reverse Proxy / Ingress | Protocol / TLS |
|---|---|---|---|---|
| **Local Development** | `http://localhost:3000`, `http://127.0.0.1:3000` | `http://localhost:3001/api/v1` | Direct Node process | HTTP/1.1 |
| **Staging** | `https://staging.itziec.com` | `https://api.staging.itziec.com/api/v1` | Cloudflare Ingress -> AWS ALB -> ECS | TLS 1.3, HSTS (max-age=31536000) |
| **Production** | `https://itziec.com`, `https://www.itziec.com` | `https://api.itziec.com/api/v1` | Cloudflare Edge -> AWS ALB -> ECS Fargate | TLS 1.3, Strict HSTS, HTTP/2 |

> **Security Rule:** Wildcard origins (`*`) are strictly forbidden when credentials (`Access-Control-Allow-Credentials: true`) are enabled. All origins must match exact approved domain entries.

---

## 2. Cookie Specification (`itziec_refresh`)

Refresh tokens are stored exclusively in an HTTP-only, secure cookie to mitigate cross-site scripting (XSS) token extraction.

| Parameter | Local Development | Staging | Production | Rationale |
|---|---|---|---|---|
| **Name** | `itziec_refresh` | `itziec_refresh` | `itziec_refresh` | Uniform identifier |
| **HttpOnly** | `true` | `true` | `true` | Prevents JavaScript DOM access |
| **Secure** | `false` | `true` | `true` | Required for HTTPS and TLS transmission |
| **SameSite** | `Lax` | `None` (if cross-subdomain) or `Lax` | `Lax` | Defends against cross-site request forgery |
| **Path** | `/api/v1/auth` | `/api/v1/auth` | `/api/v1/auth` | Scoped strictly to authentication lifecycle routes |
| **Domain** | Unset (Host-only) | `.staging.itziec.com` | `.itziec.com` | Allows shared session between subdomains |
| **Max-Age** | 604800 (7 days) | 604800 (7 days) | 604800 (7 days) | Bounded lifetime matching refresh family limit |

---

## 3. CORS Configuration & Header Exchange

### Allowed Request Headers
The backend API explicitly authorizes the following headers in preflight (`OPTIONS`):
- `Content-Type`
- `Authorization` (Bearer JWT)
- `X-Request-Id` (Client correlation identifier)
- `Idempotency-Key` (Mutation deduplication key)
- `If-Match` (Optimistic concurrency version tag)
- `Accept`

### Exposed Response Headers
The backend explicitly exposes the following response headers to browser client JavaScript:
- `X-Request-Id`: End-to-end request identifier
- `X-Trace-Id`: Distributed tracing span identifier
- `Retry-After`: Rate-limit backoff guidance (seconds)
- `X-RateLimit-Limit`: Maximum allowable requests in quota window
- `X-RateLimit-Remaining`: Remaining request allowance
- `X-RateLimit-Reset`: UNIX timestamp when quota resets

---

## 4. CSRF Defense Policy

1. **State-Changing Mutations:** All state-changing endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) require an `Authorization: Bearer <token>` header or a cryptographic `Idempotency-Key`. Browsers cannot attach custom headers during cross-site forged form submits.
2. **Refresh Route:** The `/api/v1/auth/refresh` endpoint utilizes `SameSite=Lax` cookies, blocking cross-site background submission while permitting top-level navigable transitions.
3. **Preflight Enforcement:** Any credentialed request initiating from an unlisted origin is rejected with HTTP `403 Forbidden` at CORS filter before controller execution.

---

## 5. Distributed Observability Handshake

To ensure continuous end-to-end trace correlation between Frontend (Next.js / Browser) and Backend (NestJS / BullMQ / PostgreSQL):

```
[Browser Client / Next.js]
       │
       ├─► Generates or carries `X-Request-Id: <uuidv4>`
       ├─► Captures Sentry / OpenTelemetry client trace context
       │
       ▼ (HTTPS Request)
[API Ingress / NestJS Backend]
       │
       ├─► Assigns `req.requestId = headers['x-request-id'] || uuidv4()`
       ├─► Attaches `X-Trace-Id` to trace context
       ├─► Injects `requestId` into structured Winston logs & Audit records
       ├─► Propagates `requestId` into BullMQ worker jobs and Outbox events
       │
       ▼ (HTTPS Response)
[Browser Client Receives Headers]
       │
       └─► Logs `X-Request-Id` on API error boundaries for user support tickets
```

### Telemetry Privacy Constraints (NFR-SEC-004)
The following fields are globally excluded from logs, error responses, and telemetry spans:
- Plaintext passwords and password hashes
- Refresh token values and signatures
- Candidate CV binary payloads and unredacted raw extracted text
- Personally identifiable contact info (phone numbers, national IDs)
- Unmasked invitation tokens
