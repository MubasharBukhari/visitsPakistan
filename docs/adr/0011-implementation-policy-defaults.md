# ADR-0011: Delegated implementation policy defaults

Date: 2026-10-02

Status: Adopted architecture defaults under owner delegation; no features implemented

Sprint 0 update: [ADR-0012](0012-sprint-0-platform.md) supersedes the Strapi/separate-CMS-database assumptions, selects pnpm/Nx and makes S3 migration subject to later owner authorization. Canonical domain ownership remains unchanged.

## Context

The owner confirmed Next.js, PostgreSQL as initial storage and RBAC, and instructed engineering to resolve other questions using best practices from similar discovery/marketplace platforms. A concrete baseline is needed instead of leaving business rules undefined. Another platform's exact commercial rules are not automatically VisitsPakistan requirements.

## Decision

Adopt [implementation defaults](../02-architecture/implementation-defaults.md): verified identity, revocable sessions, scoped RBAC with ownership, staff MFA, separate trust/entitlements, reviewed verification/reapplication, fit-based matching with fair ties, up to three consented recipients, 14-day requests, default 7-day sent quote validity and one accepted quote per request. Acceptance has no booking/payment effect.

Use PostgreSQL/PostGIS initially for canonical records and session/RBAC/outbox/media metadata; protected local media bytes with off-host backups and S3 migration later. Narrative release sequencing controls workbook scope. English first and canonical public trailing slashes follow the named SEO master. Purpose-limited retention/deletion, consent-based optional analytics, tested recovery targets and audience-measured host selection are specified rather than remaining undecided.

The authoritative SEO source is `docs/06-seo/500_Page_Content_SEO_Master.xlsx`. Read-only inspection found 500 opportunities and 285 distinct proposed URLs; opportunity values match the older workbook. Consolidate duplicates without dropping useful intent or inventing extra pages.

## Alternatives

Repeatedly asking for every policy choice would not follow owner delegation. Silently inventing undocumented rules would violate the engineering constitution. Copying another marketplace's quotas/contracts/retention rules would not establish local suitability. Explicit project defaults with rationale, tests and change control provide a reviewable baseline.

## Consequences

Foundation planning can proceed without unresolved frontend/auth/storage policy conflicts. Tests and constraints must reflect the defaults, especially concurrent acceptance, consent sharing, trust independence and deletion after restore. Numerical limits are configurable but not silently changed. Hosting credentials, evidence of performance, actual licenses and applicable privacy obligations are verified during implementation; the document does not claim those facts already exist.

## Review triggers

Measured spam/conversion/fairness outcomes, partner review operations, incidents, applicable legal obligations or international expansion may justify revised defaults. Record significant changes in a superseding ADR with migration/user-impact plan. Payment, messaging automation, social login and AI providers remain deferred until their features are authorized.

## Validation

Documentation consistency and source inventory now; role/ownership, MFA/session, consent/matching, acceptance race, expiry, deletion/restore and canonical URL tests during implementation. Lint/typecheck/unit/integration/build gates become executable with the application foundation.

## References

[OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [Google Analytics PII policy](https://support.google.com/analytics/answer/6366371?hl=en), [system architecture](../02-architecture/system-architecture.md), [SEO inventory](../06-seo/opportunity-inventory.md), [ADR index](README.md). Security/privacy guidance supports mechanisms; project-specific expiry, retention and matching numbers are engineering defaults.
