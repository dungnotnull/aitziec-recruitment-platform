# Frontend Instructions

This file extends the root `CLAUDE.md` for work under `frontend/`. The frontend framework is not selected yet; do not introduce framework-specific conventions until the Phase 0 decision is recorded in `PROJECT-DETAIL.md` and `CHANGELOG.md`.

## Required reading

Before frontend work, read root `CLAUDE.md`, `API-CONTRACT.md`, the active phase in `docs/ROADMAP.md`, and both frontend tracking files.

## Ownership and contract workflow

- The FE agent is the only writer of `DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md` and `ISSUES-LIST-TRACKING.md`.
- Before changing an endpoint, DTO, enum, query parameter, or response assumption, update `../API-CONTRACT.md` first.
- Never silently compensate for an undocumented backend shape. Record a contract proposal or an issue.
- Generate or maintain one typed API layer from the agreed contract. UI components must not call `fetch`/HTTP clients directly.

## Structure and boundaries

Use feature-oriented organization after framework selection:

```text
src/
  app/          # bootstrap, routing, providers
  features/     # auth, jobs, applications, profile, admin
  shared/       # UI primitives and framework-neutral helpers
  api/          # generated/shared DTOs and transport client
```

- Keep server state in the selected query/cache layer and local UI state near its owner.
- Do not duplicate contract enums as free-form strings.
- Treat error `code` as programmatic and `message` as display/fallback text.
- Support loading, empty, error, unauthorized, and retry states for every remote view.
- Preserve search/filter state in the URL where it benefits navigation and sharing.

## Quality and security

- Strict TypeScript, accessible semantic HTML, keyboard navigation, and responsive layouts.
- Do not render unsanitized job descriptions, CV contents, or AI output as HTML.
- Do not log or persist access tokens, refresh tokens, CV contents, or presigned URLs in client analytics/storage.
- Mock APIs from `API-CONTRACT.md`, not from ad hoc component fixtures.
- Add component tests for meaningful interaction and E2E tests for critical journeys.

## Tracking updates

After each frontend work unit, update the phase log with date, contract version, outcome, verification, and next action. Create a stable issue ID for unresolved defects; close it only with verification evidence.

