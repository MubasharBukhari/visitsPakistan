# ADR-0015: Custom editorial CMS and immutable publication snapshots

Status: Accepted. Date: 2026-10-02.

## Decision

Implement the user-approved custom CMS in Next.js, with NestJS owning editorial commands and PostgreSQL persistence. This supersedes Strapi as the initial CMS implementation; the canonical graph remains independently authoritative. Use Tabler's MIT-licensed admin styling and icons, adapted to Majestic Indus brand colors and self-hosted Playfair Display/Plus Jakarta Sans fonts.

An editorial document references a canonical ContentItem UUID and versioned editorial revisions. Destination and attraction families reference the relevant GeoEntity or Place UUID. All eight editorial families use typed presentation blocks and explicit canonical UUID references, never copies of structured travel facts. Public APIs read only a published snapshot; editing creates a separate draft. Draft → review → approved → published requires a different reviewer, sources, verification, approved canonical references and compatible templates. Optimistic document versions and serializable transactions prevent lost updates. Database guards preserve published revisions and append-only audit records. Every mutation records an outbox event atomically; delivery workers remain future work.

Staff authentication uses Argon2id passwords, encrypted TOTP secrets with replay protection, revocable opaque sessions and fixed RBAC roles. The Next.js BFF holds the token in an HttpOnly cookie and checks request origins. Contributors edit their own drafts, editors review/publish, and administrators manage presentation. Administrator status alone does not imply editor permission. Local bootstrap is development-only; production staff provisioning and recovery require an operational procedure before launch.

Themes use validated color/font/spacing tokens; templates use allowlisted layouts and block types. No arbitrary executable HTML, CSS or JavaScript is accepted. Media is validated, resized and re-encoded to WebP with metadata removed. Local disk storage with a persistent volume supports development and the initial single-server Hetzner deployment, following AGENTS.md and ADR-0012. Production requires a configured media directory, capacity monitoring, retention rules and off-host backups coordinated with database recovery. An S3-compatible adapter is a future option if scale warrants a reviewed architecture change.

## Consequences

The team owns CMS maintenance and workflow security, but avoids a second entity authority and an unnecessary distributed editorial service. Public reads are uncached initially, ensuring publication and withdrawal take effect immediately. Search/cache consumers can later use the outbox. Theme/template changes are site-wide and audited; historical presentation versions and scheduled publication are outside this scope. The screenshot-derived baseline logo is a reconstruction, pending an authoritative vector asset.
