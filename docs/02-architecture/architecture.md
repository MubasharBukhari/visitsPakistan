# VisitsPakistan --- Solution Architecture

## Decision

Begin as a **modular monolith** on a **standalone Linux server**.
Logical domain boundaries must allow later extraction without imposing
microservice operations at launch.

## Frontend

React + TypeScript + **Next.js App Router**. Public SEO pages use static
generation/revalidation or server rendering; a client-only SPA is not acceptable for
primary indexable travel content. Nginx serves static assets and proxies
SSR/API traffic.

## Backend

NestJS + TypeScript, REST under `/api/v1`, OpenAPI, domain modules,
background jobs through Redis-backed queues when needed.

## CMS

Custom CMS with a Next.js admin presentation in `apps/cms`. Future editorial
commands/revisions are owned by the NestJS Content module, separately from
canonical travel entities. Sprint 0 exposes an inert shell only; no Strapi
runtime or second CMS backend is deployed. See [ADR-0012](../adr/0012-sprint-0-platform.md).

## Data and Search

PostgreSQL + PostGIS is initial canonical SQL storage; Prisma and controlled SQL migrations manage schemas. OpenSearch is derived search
infrastructure. PostgreSQL also stores revocable sessions. Redis handles disposable cache/rate limits and durable queues in separately configured instances.

## Storage

Phase 1 uses local folders behind `StorageService`:
`/srv/visitspakistan/storage/public` and
`/srv/visitspakistan/storage/private`. Phase 2 introduces an
S3-compatible provider using the same object keys and service contract only
when separately authorized.

## Logical Modules

identity, geography, destinations, places, experiences, content, food,
routes, itineraries, events, partners, products, leads, quotes, search,
media, analytics and admin.

## Request Flow

Browser → CDN/WAF → Nginx → Next.js frontend/SSR → NestJS API → domain modules →
PostgreSQL/PostGIS. Search queries use OpenSearch; cache/jobs use Redis;
editorial commands use the Content boundary; media uses StorageService.

## Knowledge Graph

Canonical entities are independent of CMS pages. `entity_relation`
supports PART_OF, HAS_ATTRACTION, HAS_EXPERIENCE, HAS_CUISINE,
HAS_ROUTE, NEAR, ABOUT, VISITS and OPERATES.

## Security

TLS at Nginx; public published APIs only; partner ownership checks;
RBAC plus per-resource ownership; verified-email/password authentication, secure revocable sessions and staff MFA; private verification files; environment secrets; rate
limits; audit logs.

## Scaling Path

Vertically scale the Hetzner server first; move media to S3/CDN only when authorized,
database/search/cache to dedicated infrastructure as justified, and only
then extract high-value modules into services.
