# VisitsPakistan engineering handoff

Updated: 2026-10-02 (Asia/Qatar). Branch: `main`. Reviewed HEAD: `b1ba3d6`.

## Current state

Sprint 0, canonical travel graph and the custom editorial CMS are implemented. Read [AGENTS.md](AGENTS.md), [CMS plan](docs/02-architecture/cms-implementation-plan.md), [ADR-0015](docs/adr/0015-editorial-cms-workflow.md), [CMS setup](docs/development/editorial-cms.md), [local development](docs/development/local-development.md) and [canonical plan](docs/02-architecture/canonical-graph-plan.md). Architecture stays in `docs/02-architecture`; data documents are in `docs/03-data`.

Next.js CMS uses MIT Tabler styling/icons, Majestic Indus tokens and self-hosted Playfair Display/Plus Jakarta Sans. Eight editorial families share typed blocks, provenance, author/reviewer, verification, SEO and hero media. Theme/template management and public website renderers are implemented. Logo is a screenshot-derived reconstruction awaiting the approved original vector; hero is an illustration. Notices are retained in `docs/licenses`.

NestJS owns editorial commands and staff sessions. Contributors edit their own drafts, editors review/publish, administrators manage presentation. Passwords use Argon2id; TOTP secrets are encrypted, codes replay-protected, opaque sessions revocable/idle-expiring. Same-origin BFF uses HttpOnly cookies and origin checks. Local bootstrap refuses production; credentials remain in ignored `.cms-bootstrap.json`, never in this handoff. Production provisioning/recovery is not implemented.

EditorialDocument UUID references ContentItem; revision reference joins point to EntityRegistry UUIDs. Canonical entities remain authoritative; there is no CMS structured entity editing. Draft → review → approved → published prevents self-review. Published snapshots remain immutable during new draft edits; withdrawal hides public content. Expected versions, serializable retries, audit and atomic outbox events protect mutations. Outbox delivery remains future work. PostgreSQL guards enforce immutability, source/reference integrity and append-only audit.

## Storage and sample

Reuse authorized existing PostgreSQL 17/PostGIS on host port 5433, development `visitspakistandb`, test `visitspakistandb_test`. No resets or replacement containers. Baseline, three graph migrations and additive editorial migration are applied to both databases. Future changes require additive migrations; do not rewrite applied SQL-owned guards/spatial indexes.

The canonical seed preserves existing records and remains unverified development data. `pnpm cms:bootstrap` ran twice, providing local staff accounts, one Hunza editorial draft, baseline theme and three templates assigned to eight families. Fixture sources and unpublished canonical references block sample publication. Anonymous sample retrieval is 404; authenticated CMS retrieves it. No partner/product implementation.

Media accepts bounded static images, removes metadata and re-encodes WebP. Draft media is private. Development media lives in ignored `.data/media`; Compose persists it via `cms-media`. Docker excludes local data and bootstrap credentials. Initial production uses persistent local media on the single Hetzner server under AGENTS.md/ADR-0012. Retention, capacity monitoring and off-host combined DB/media backups remain required; S3 is an optional future adapter. Public reads use no-store; publication/withdrawal do not await cache/search workers.

## Verification

Frozen install, Prisma format/validate/generate, migrations, idempotent bootstrap, lint, typecheck, 32 unit tests, 34 real integration tests, all 12 builds, formatting and Compose configuration passed. Tests include real authentication/HTTP publication, unauthorized access/self-review, snapshot preservation, concurrency, fixture/canonical gates, database immutability, presentation and session expiry/revocation. Security smoke checks confirmed anonymous admin 401, missing-origin write 403, anonymous Hunza draft 404 and readiness/Swagger 200.

Browser checks covered branded desktop dashboard, authenticated editor preview, template assignments and mobile drawer. Final fresh-session author login/editor navigation produced no browser errors or console messages. Website and editor at 390px showed loaded fonts/images and no horizontal overflow. During verification, build output replacement required restarting UI servers before final checks; avoid building into a running Next standalone directory. Closed mobile navigation visibility and content-link semantics were corrected. No cloud deployment, load testing, production onboarding, restore testing or CMS Docker image rebuild is claimed.

Resume verification: re-ran lint, typecheck, unit target checks, integration tests (34 passed), all project builds and formatting successfully. Nx reused unchanged unit/type/lint/build outputs where applicable. No application code changes were needed. Corrected CMS storage notes to match the existing local-media/single-Hetzner-server decision in AGENTS.md and ADR-0012; no new storage architecture was introduced. Browser results above are from the completed implementation session, not repeated during this resume.

## Next action and repository state

Read CMS setup to run local login. Before launch: approve real sources/canonical travel facts, replace original logo, provision staff/recovery, configure persistent local media/off-host backups and deployment-appropriate throttling, deliver outbox events, and verify production backups/restore. Do not invent missing canonical route/itinerary facts.

Preserve pre-existing root README deletion and untracked owner files. No staging/commit. Secrets remain ignored; Redis/OpenSearch/PostgreSQL development containers remain running. Temporary application processes used for verification are stopped at session completion.
