# ADR-0012: Sprint 0 workspace and custom CMS

Date: 2026-10-02. Status: accepted under the owner's Sprint 0 instruction.

> Database topology superseded by [ADR-0013](0013-existing-local-postgis.md); other decisions remain accepted.

## Context

The owner requested pnpm/Nx, three applications, nine libraries, native local PostgreSQL/PostGIS, Docker Redis/OpenSearch, Swagger and a custom CMS. Earlier architecture described Strapi; current AGENTS.md instead confirms a custom CMS, local media and a future single Hetzner host.

## Decision

Use a pnpm 10 workspace orchestrated by Nx, with explicit project targets. Next.js serves `apps/web` and the inert custom CMS presentation shell in `apps/cms`; NestJS in `apps/api` remains the sole business API. Requested `libs/` packages expose narrow public contracts. Nx lint boundaries prevent frontend database/infrastructure imports and keep domain code independent of adapters. Strict TypeScript, ESLint, Prettier and Jest are foundation gates.

Select stable Prisma 7.10.0 with the PostgreSQL driver adapter rather than Prisma 8 release candidates. SQL migrations enable PostGIS and record a platform schema marker; no tourism tables are created. Native PostgreSQL stays on port 5432. Integration tests use a separately named `_test` database and never reset an existing database. Docker Compose supplies Redis and OpenSearch on loopback ports; app images are opt-in via the `apps` profile.

Custom CMS replaces the Strapi runtime/adapter choice in ADR-0003 and earlier documents. CMS is a Next.js admin presentation, with future editorial commands owned by the NestJS Content boundary. Editorial tables/workflows are independently owned within application PostgreSQL; canonical travel entities remain independent. No second CMS backend/database, Strapi package, admin data or authentication flow is introduced in Sprint 0. A separate editorial database can be evaluated later only with an ADR.

Liveness is dependency-free. API readiness returns 503 for missing canonical database/schema/PostGIS; optional Redis/search outages return 200 with `degraded` capability states. Next.js readiness delegates to API readiness without exposing private details. Swagger is explicitly enabled in development and disabled by default. Production deployment hardening, authentication, queue workers, CI deployment, backups/restore operations and editorial features are later work, not claimed complete by this sprint.

## Consequences and alternatives

Nx run-command targets keep framework builds transparent without adding unnecessary plugin generators. Explicit workspace dependencies and target caching support incremental builds. A full CMS product or login system now would exceed Sprint 0; the custom admin shell contains no privileged operations. A PostgreSQL container would contradict the requested native database. OpenSearch security is disabled only for loopback development; these Compose settings are not production-ready.

Local media remains the confirmed storage direction. S3 migration is optional future work requiring owner authorization, consistent with current AGENTS.md. Production host choice is Hetzner; provisioning is outside this sprint.

## Validation

Install/lockfile, lint/import boundaries, strict typecheck, focused unit and HTTP tests, isolated live infrastructure integration, production builds, Docker/Compose validation, runtime endpoint/HTML smoke tests and documentation link checks. Report exact results in the Sprint 0 plan and handoff.
