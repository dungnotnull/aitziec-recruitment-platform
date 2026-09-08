# Changelog

All notable changes to the ITZiec project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and documentation/release versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Runtime features are recorded only after implementation and verification. A
documentation entry is not evidence that the described application behavior is
available.

## [Unreleased]

### Added

- No unreleased runtime capability has been verified.

### Changed

- Restricted implementation documentation and task tracking to backend work.

### Removed

- Removed `frontend/CLAUDE.md` and its Phase 0 documentation task because
  frontend implementation is outside the active scope.

## [0.1.0] — 2026-09-08

### Added

- Repository-wide conventions and source-of-truth hierarchy in `CLAUDE.md`.
- Implementation-oriented product requirements in `PROJECT-DETAIL.md`.
- Proposed `/api/v1` frontend/backend contract in `API-CONTRACT.md`.
- NestJS + Prisma backend conventions in `backend/CLAUDE.md`.
- Milestone roadmap for backend Phases 0 through 7.
- Detailed backend phase task tracker with stable task IDs and acceptance
  evidence.
- Backend issue register for durable defect, risk, and decision tracking.
- Documentation design spec and implementation plan under `docs/superpowers/`.

### Changed

- Confirmed React + Vite as the frontend framework and Prisma as the backend ORM.
- Verified the Phase 0 documentation baseline through path, link, reference,
  UTF-8, terminology, lifecycle, and whitespace checks.
- Reframed the README as an accurate project-status and documentation entry
  point.
- Labeled all application capabilities and endpoints as planned rather than
  implemented.

### Security

- Declared AI output advisory and prohibited autonomous application decisions.
- Established contract rules for private CV storage, short-lived downloads,
  token redaction, rotating refresh sessions, authorization scope, and
  transactional audit/outbox records.

### Known limitations

- No frontend or backend runtime application exists in this version.
- Local development commands remain targets until Phase 1 is verified.
- CV retention, early pipeline rejection, AI provider privacy, production
  topology, cookie/CSRF assumptions, search benchmarks, and password-hash
  parameters remain tracked backend decisions or risks.

## Changelog Maintenance

- `Added`: new user-visible capability, endpoint, document, or operational tool.
- `Changed`: behavioral, contract, schema, dependency, or milestone change.
- `Deprecated`: supported behavior scheduled for removal.
- `Removed`: removed behavior after its migration window.
- `Fixed`: verified defect resolution with issue reference.
- `Security`: security-relevant change or verified remediation.
- `Known limitations`: explicit release constraints that remain unresolved.

Every runtime entry should reference the affected contract section, backend task
or issue, and verification evidence in its change set.
