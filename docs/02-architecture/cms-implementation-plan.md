# CMS implementation plan

Resume point: repository/data/architecture inspection only; no earlier CMS files were changed. Custom Next.js CMS calls NestJS Content commands; canonical travel data stays in its UUID registry/owner tables.

Implement eight editorial families, revisioned structured blocks, canonical references, authors/reviewers/source references, SEO/media/freshness fields and DRAFT → REVIEW → APPROVED → PUBLISHED. Editing published content creates a new draft while the old snapshot stays public. Staff authentication and scoped RBAC protect every admin API; reviewer cannot approve own work. Add transactional audit/outbox records for workflow and presentation changes.

Use open-source MIT Tabler CSS with accessible React navigation, responsive content/edit/review/media/theme/template screens and provided Majestic Indus colours (#0D5C3A/#D97736/#0284C7/#0F172A), Playfair Display and Plus Jakarta Sans. Reconstruct a baseline vector mark from the supplied screenshot because no separate logo file exists in the repository; document replacement with the original production asset. Themes store validated tokens; templates select allowlisted layouts/blocks, never uploaded executable code. Frontend uses published snapshots and active presentation settings.

Schema: editorial documents/revisions/references/sources, staff/session/RBAC foundation, local media metadata, themes/templates/settings, append-only audit and transactional outbox. Content links canonical UUIDs; no copies of coordinates, hours/prices/durations/availability. Route/itinerary guides are editorial only until canonical owners exist. Hunza sample remains a development draft referencing the existing canonical Hunza UUID, not falsely approved published travel data.

Tests: validation/workflow/RBAC unit tests; real DB/API draft isolation, wrong role/self-review denial, revision preservation/optimistic concurrency, canonical/source/media gates, audit/outbox atomicity, staff session expiry/revocation and public retrieval. Test publication with isolated synthetic records only. Run migrations on development/test DB without resets, idempotent sample seed, install/format/lint/types/unit/integration/build, API retrieval and desktop/mobile browser verification.

Risks: editorial approvals do not approve canonical facts, sample fixtures cannot publish, MFA secret encryption requires an environment key, templates/media must not admit XSS or path traversal, and user uploads require rights confirmation. Production deployment remains separate; no partner/product functionality.

## Implementation evidence

The additive editorial migration is applied to development and test databases. Bootstrap ran twice and preserved the Hunza draft and staff credentials. The eight models, protected staff API, editorial revision workflow, media pipeline, theme/template management and public SSR rendering are implemented. The full suite passes: frozen install, lint, typecheck, 32 unit tests, 34 PostgreSQL-backed integration tests, all 12 project builds and formatting. Compose configuration validates. Browser checks cover authenticated draft retrieval/preview, template controls, mobile navigation and publication isolation; final UI checks run against freshly restarted built applications. No deployment or production restore test is claimed.
