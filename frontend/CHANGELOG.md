# Changelog

## Unreleased

### Added

- Real-API notification center with read-state synchronization and safe resource links.
- Bounded asynchronous operation tracking and CV-processing handoff.
- Advisory CV-to-job analysis, evidence presentation, recommendations, and natural-language job search.
- Admin user moderation and redacted audit-log exploration.
- Global unread-notification badge backed by server metadata, direct interview detail, and known-target company/job moderation.
- Executable live-Swagger verifier covering all 53 frontend-required endpoints.
- Role-aware responsive navigation, dark-theme tokens, reduced-motion support, real-environment E2E scaffolding, and production sensitive-data scanning.

### Changed

- Removed runtime CV upload, profile-visibility, company-id, and dashboard-count mock data.
- Removed the invented `/companies/mine` consumer and hard-coded skill catalog; company context and skill IDs now come only from backend responses.
- Aligned refresh-session bootstrap, `FRESHER`, repeated array queries, multipart boundaries, notification/interview pagination adapters, notification resource fields, AI weights/types, and audit date/nullability fields with backend DTOs.
- Excluded router developer tools from production bundles.

### Known blockers

- AI consent/retention, company/job collection discovery, application administration, production CSP/telemetry/topology, localization, and approved performance budgets require unresolved contracts or environment decisions recorded in the tracking log.
- Authenticated live journeys are blocked locally by backend migration `P3018` and four notification unit-test timeouts; frontend live Swagger verification still passes 53/53 endpoints.
