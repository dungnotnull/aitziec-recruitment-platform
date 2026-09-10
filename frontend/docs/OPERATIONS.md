# Frontend operations runbook

This runbook covers the browser application only. It does not define or deploy backend infrastructure.

## Release gates

Run from `frontend/` on Node and npm versions declared in `package.json`:

```text
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run security:frontend
```

With the real backend running, verify every endpoint consumed by the frontend against its Swagger document:

```text
BACKEND_OPENAPI_URL=http://127.0.0.1:4000/api/docs-json npm run contract:backend
```

The command reports a missing controller route as a failure. It never supplies a fallback response.

Run browser journeys against a real environment; the suite does not install runtime request mocks:

```text
PLAYWRIGHT_BASE_URL=https://staging.example.test npm run test:e2e
```

For local execution, start `npm run dev -- --host 127.0.0.1` in one terminal, then run `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm run test:e2e` in another. CI starts the local Vite server automatically when `PLAYWRIGHT_BASE_URL` is absent.

Authenticated journeys additionally require `E2E_CANDIDATE_EMAIL`, `E2E_CANDIDATE_PASSWORD`, `E2E_RECRUITER_EMAIL`, `E2E_RECRUITER_PASSWORD`, `E2E_ADMIN_EMAIL`, and `E2E_ADMIN_PASSWORD`. A skipped credential-gated test is not a release pass.

## Configuration contract

- The browser calls same-origin `/api/v1`; local Vite proxies `/api` to `http://localhost:4000`.
- Production must route `/api/v1` to the approved backend origin and keep refresh tokens in backend-managed HttpOnly cookies.
- Do not put credentials, bearer tokens, signed download URLs, raw CV text, prompts, or private audit metadata in build-time environment variables.
- CSP, telemetry destinations, cache headers, health checks, and rollback identifiers remain release blockers until FEI-003 and FEI-015 define the production topology.

## Incident checks

### Bad deployment or chunk load failure

1. Confirm the failing asset URL and immutable artifact identifier.
2. Check that `index.html` is not cached as immutable and that hashed assets are still available.
3. Roll back the frontend artifact through the hosting platform; do not rewrite an existing hashed artifact.
4. Re-run the guest smoke test and one authenticated route per role.

### API outage or timeout

1. Confirm `/api/v1` routing independently of the frontend asset origin.
2. Capture the safe request ID shown by the UI; never copy authorization headers or response bodies containing personal data.
3. Verify that mutations are not silently retried and that polling stops at its bounded timeout.
4. After recovery, use the visible retry action and confirm cached role-scoped data has not crossed sessions.

### Authentication loop

1. Check the login response and refresh-cookie attributes in browser developer tools without exporting cookie values.
2. Verify origin, HTTPS, cookie domain/path, SameSite policy, and backend refresh/revocation behavior.
3. Sign out and confirm the frontend query cache is cleared before testing another account.
4. Escalate repeated refresh failures with request IDs and timestamps only.

### Telemetry outage

The application must remain usable when telemetry is unavailable. Do not weaken CSP or send sensitive payloads as a workaround. Telemetry integration is blocked until FEI-015 is approved.

## Rollback evidence

Record the source commit, semantic version, artifact identifier, deployment time, operator, smoke-test result, and rollback target. Release tagging is allowed only after all unchecked Phase 7 gates have independent evidence.
