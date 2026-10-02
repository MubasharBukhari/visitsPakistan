# Sprint 0 local development

## Scope and prerequisites

The workspace includes platform tooling, the canonical knowledge graph and the custom editorial CMS. Staff authentication, editorial workflow, presentation management and published content APIs are implemented. See [editorial CMS setup](editorial-cms.md) for bootstrap and login instructions. Partner, product and marketplace features remain outside scope.

Use Node.js 22.20 (minimum 22.12), pnpm 10.29.2, Docker with Compose, and the existing `vp-postgres` PostgreSQL 17/PostGIS container published at localhost:5433. Reuse this container; Compose manages only Redis/OpenSearch and optional applications. Allocate at least 4 GB to Docker. OpenSearch may require `vm.max_map_count=262144` on Linux. Compose is development-only, with search security disabled and ports bound to loopback.

## Setup

```sh
pnpm install
cp .env.example .env
pnpm infra:up
```

Edit `.env` for your machine; it is ignored by Git. `.env.example` contains the owner's local-only database settings. Configuration validation reports field names without secret values. `DATABASE_URL`, if set, overrides DB fields for the API/Prisma; the Compose API profile clears that override and uses DB fields with `host.docker.internal` so a host URL cannot point back into the API container. Never put server credentials in `NEXT_PUBLIC_*` variables.

Use `visitspakistandb` and `visitspakistandb_test` (created and migrated on the existing server); create them if absent using an authorized PostgreSQL administrative connection. Do not reset existing databases. The migration role must be allowed to enable PostGIS; use a separate least-privilege application role before deployment.

```sh
pnpm db:migrate
pnpm db:migrate:test
pnpm dev
```

The migration command checks connectivity/PostGIS availability before changing migration history. The SQL migration enables PostGIS and creates only a platform schema marker. Prisma client generation also runs at install. The test migration script requires a separate DB_TEST_NAME ending in `_test`; integration tests are read-only probes and refuse the primary DB. The existing Docker server has PostGIS available. No native PostgreSQL add-on installation is needed for this development configuration. The test migration script explicitly targets the isolated test URL so dotenv cannot restore the primary database URL in child processes.

## Applications and endpoints

| Application          | URL                                 | Commands                                  |
| -------------------- | ----------------------------------- | ----------------------------------------- |
| Web                  | http://localhost:3000               | `pnpm dev:web`                            |
| API                  | http://localhost:4000               | `pnpm dev:api`                            |
| Custom editorial CMS | http://localhost:3001               | `pnpm dev:cms`                            |
| Swagger UI           | http://localhost:4000/api/docs      | Development only via SWAGGER_ENABLED=true |
| OpenAPI JSON         | http://localhost:4000/api/docs-json | Generated from NestJS controllers         |

All three apps expose `/health` and `/ready` (Next.js slash redirects apply). API liveness is process-only. Readiness checks migrated PostgreSQL/PostGIS and exposes safe Redis/search capability states. Missing database/schema/PostGIS returns 503; optional Redis/search failures return 200 `degraded`, matching the modular-monolith availability policy. Integration tests require **all** dependencies healthy. No URLs, credentials, stack traces or raw SQL errors appear in readiness responses. Next.js readiness delegates to API readiness with a timeout; it returns 503 if the API is unavailable. Swagger is off by default unless enabled explicitly; production must restrict documentation if enabled.

## Workspace commands

```sh
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm exec nx show projects
pnpm exec nx run web:start
# In another terminal: pnpm exec nx run cms:start and pnpm exec nx run api:start
```

Nx has explicit lint/typecheck/build targets for all apps and libraries. Unit targets exist where implemented behavior needs tests; empty domain boundaries do not receive placeholder tests. Jest HTTP tests use stub ports; live integration uses the isolated migrated test DB, Redis PING and OpenSearch cluster health. Builds do not require live infrastructure. Nx caches deterministic tasks; integration probes are never cached. Generate the Prisma client before direct per-project typechecking on a clean checkout (`pnpm db:generate`). Next.js also generates route types during build/dev.

## Docker

Default Compose starts only Redis and OpenSearch. Application containers are optional:

```sh
docker compose --profile apps up --build -d
```

Run migrations from the host first. Containers reach the existing database through `host.docker.internal:5433`; Linux uses the included host-gateway mapping. The database container is external to this Compose project and is not recreated or removed by its commands. Keep it running before migrations or application startup.

This machine has about 2 GB allocated to Docker; stop OpenSearch while building images, build one app at a time, then restart infrastructure, or allocate at least 4 GB before building all images concurrently. Each app has a multi-stage Dockerfile, locked install, build, non-root runtime and liveness healthcheck. Web/CMS use Next.js standalone outputs. API bundles internal workspace code and keeps runtime third-party dependencies available. Dockerfiles are development foundation artifacts; production TLS/WAF/secrets/backups and restricted staff access are not configured by this Compose file.

`pnpm infra:down` stops services and retains data volumes. Do not use `down -v` unless you intentionally want to delete development Redis/search data. Sprint 0 Redis is a cache only; durable queues are not implemented and will require a separate no-eviction instance later.

## Boundaries and architecture

Applications: `apps/web`, `apps/api`, `apps/cms`. Libraries: `libs/domain`, `database`, `search`, `cache`, `auth`, `config`, `ui`, `analytics`, `testing`. Domain remains framework-free; frontends consume UI/domain, not infrastructure. ESLint/Nx enforces tagged import boundaries. Custom CMS is presentation over the future NestJS Content module, not a separate canonical entity store.

See [Sprint 0 plan](../02-architecture/sprint-0-plan.md), [ADR-0012](../adr/0012-sprint-0-platform.md) and [system architecture](../02-architecture/system-architecture.md). Docker image builds and runtime checks performed for this environment are reported in the handoff, not assumed from configuration alone.

## Canonical knowledge graph

Apply the additive graph migrations with `pnpm db:migrate` and `pnpm db:migrate:test`. Run `pnpm db:seed` (or `pnpm exec prisma db seed`) to insert development drafts for Pakistan, Gilgit-Baltistan, Hunza, Skardu, Islamabad, Lahore and Karachi, plus supporting hierarchy/reference fixtures. The seed command refuses NODE_ENV=production. Seed points are approximate and source records explicitly identify development fixtures; last_verified stays null. Fixture-backed records cannot be published. Re-running inserts missing fixtures without overwriting existing edits. A conflicting edited parent/slug fails rather than silently rewriting owner data.

The graph service/repository remains the canonical authority; the CMS references it through UUIDs and does not provide structured entity editing. Create registry/owner/relationships through a single `graphTransaction` context; the framework-free service creates drafts and validates coordinate/relation inputs. Public proximity and edge queries exclude unpublished/deleted records and retired source evidence. Serializable transaction failures must be retried by a future application use case; do not catch an error inside a transaction and commit partial state.

`pnpm test` includes domain service tests. `pnpm test:integration` includes real Prisma/PostGIS repository tests, rollback/constraint checks, meter-based proximity, all hierarchy tiers and seed idempotency. Tests use only the isolated `_test` database: random test records roll back, while deterministic draft seed fixtures remain there. Controlled SQL checks/triggers/spatial indexes must be preserved when generating later migrations. See [ADR-0014](../adr/0014-canonical-graph-storage.md).
