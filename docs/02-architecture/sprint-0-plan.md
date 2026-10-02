# Sprint 0 implementation plan

Scope: pnpm/Nx monorepo foundation only. No travel entities, editorial CRUD, login flows, marketplace or AI functionality.

## Repository and decisions

At the start of Sprint 0, the repository contained documents only. The owner now requires `apps/web`, `apps/api`, `apps/cms` and nine libraries under `libs/`, pnpm/Nx, Next.js, NestJS, Prisma, PostgreSQL/PostGIS, Docker Redis/OpenSearch and Swagger. Current AGENTS.md confirms a custom CMS and local media on a future single Hetzner host. ADR-0012 records these changes from the earlier Strapi plan. Architecture documents remain under `docs/02-architecture/`.

## Implementation sequence

1. Pin compatible stable dependencies and configure workspace tasks, strict TypeScript, ESLint, Prettier and unit/integration tooling.
2. Establish library public boundaries: domain, database, search, cache, auth, config, ui, analytics and testing. Implement only platform contracts/configuration/probes needed for this sprint.
3. Create Next.js web and custom CMS shells sharing minimal UI. CMS is an unauthenticated inert development shell, with no administrative data/actions. Authentication features remain outside Sprint 0.
4. Create NestJS API with validated configuration, bounded dependency probes, JSON logs/request IDs, `/health`, `/ready` and Swagger. No tourism endpoints. Readiness requires database/PostGIS; Redis/search failures are exposed as degraded capabilities without disabling unrelated future APIs.
5. Create Prisma baseline migration for PostGIS and a platform schema-version marker, database scripts and isolated test DB configuration. Reuse the owner's existing PostgreSQL/PostGIS container on port 5433 under ADR-0013; no replacement container or destructive reset.
6. Add Docker Compose Redis/OpenSearch, opt-in app containers and non-root multi-stage Dockerfiles. Loopback-only infrastructure ports; host PostgreSQL uses `host.docker.internal` from containers.
7. Test configuration validation, permission-denial helper, liveness/readiness and failure sanitization, OpenAPI routes and real PostgreSQL/PostGIS/Redis/OpenSearch connectivity. Check import boundaries.
8. Run install, formatting, lint, typecheck, unit/integration tests and production builds; smoke-test runtime HTML/health/Swagger and document exact outcomes.

## Risks and mitigations

- The database container is external to Compose; keep it running and preserve its volume. Native PostgreSQL PostGIS installation is no longer required after the owner-directed switch in ADR-0013.
- Redis/OpenSearch container images may require registry access, ARM support and sufficient Docker memory. Use explicit versions, bounded heap and readiness waits.
- Nx/Next/Prisma dependency versions must be validated together; Prisma latest currently includes a release candidate, so select stable 7.10.0 instead.
- Custom CMS changes editorial ownership. It is a Next.js admin presentation shell over future NestJS Content commands, not a second canonical backend; no Strapi dependency/database is created.
- Future RBAC is not authentication. The auth library provides a deny-by-default permission contract only; no private functionality is exposed without an authentication implementation.

## Verification gates

`pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, formatting and Compose validation. Real integration tests use a separately named test database and read-only dependency probes, with no tourism fixture/schema writes. Add focused HTTP tests for 503 on missing PostgreSQL/PostGIS and safe degraded responses for optional dependencies. Record environment failures accurately and fix project errors before completion.

## Verification checkpoint

Install (including frozen lockfile), formatting, lint, strict type checking, 14 unit tests, all 12 project builds and Compose validation passed. All three Docker images built and smoke containers returned healthy responses. Browser checks passed for web, CMS and Swagger; CMS mobile layout had no horizontal overflow. Next.js standalone start commands were also smoke-tested.

The owner subsequently authorized the existing Docker PostgreSQL/PostGIS server on port 5433. Development and isolated test databases were created and migrated. Both live integration tests now pass, including real dependency readiness and PostGIS geography SQL. ADR-0013 records the topology change.
