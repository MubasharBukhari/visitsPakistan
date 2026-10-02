# VisitsPakistan Project Documentation

This package is the source of truth for starting VisitsPakistan.com with
Codex.

## Implementation Architecture Review — 2026-10-02

The architecture-only review is available in
[system architecture](02-architecture/system-architecture.md),
[module boundaries](02-architecture/module-boundaries.md),
[deployment architecture](02-architecture/deployment-architecture.md) and
[ADRs](adr/README.md). It includes the dependency diagram, implementation
sequence, risks and implementation defaults.

Next.js is confirmed by the project owner. PostgreSQL/PostGIS is initial
canonical storage, RBAC with resource ownership checks governs permissions,
and local media storage precedes S3. Remaining policy defaults are recorded
in [implementation defaults](02-architecture/implementation-defaults.md) and
ADR-0011. Sprint 0 platform scaffolding is implemented; tourism and editorial features are not. See [local development](development/local-development.md) and [ADR-0012](adr/0012-sprint-0-platform.md).

Architecture documents belong in `docs/02-architecture/` by default;
ADRs remain in `docs/adr/`. Use these paths for future documentation.

## Locked Technical Direction

-   Single Hetzner Linux server for eventual production; local development now.
-   pnpm/Nx monorepo, Next.js App Router + TypeScript frontend.
-   Next.js static generation/revalidation or SSR for public SEO pages.
-   NestJS + TypeScript backend.
-   PostgreSQL + PostGIS as initial canonical SQL storage; Prisma migrations.
-   OpenSearch.
-   Redis: separate cache and queue policies; sessions in PostgreSQL.
-   RBAC plus resource ownership; verified login, revocable sessions and staff MFA.
-   Custom CMS: Next.js admin presentation over NestJS Content commands.
    Sprint 0 includes an inert shell only; no Strapi runtime.
-   Local folder storage through StorageService; S3 migration only when
    separately authorized.
-   Nginx reverse proxy.
-   Docker Compose initially.
-   Modular monolith first; extract services only when justified.

## Codex Reading Order

1.  Product vision and releases.
2.  Architecture.
3.  Knowledge graph and data schema.
4.  API contracts.
5.  UX inventory and flows.
6.  SEO architecture.
7.  Marketplace model and quote workflow.
8.  Infrastructure.
9.  Master backlog and [authoritative SEO opportunity workbook](06-seo/500_Page_Content_SEO_Master.xlsx).
10. Implementation defaults and ADRs.

The architecture PNG is retained as a conceptual reference. Where it
conflicts with written documentation, these written documents take
precedence because the deployment direction has now been explicitly
confirmed as standalone server + Next.js + PostgreSQL/PostGIS + local-first media storage.
