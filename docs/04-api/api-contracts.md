# VisitsPakistan --- API Contracts

Base path: `/api/v1`. Use consistent error format, DTO validation,
pagination, ownership authorization, rate limits and OpenAPI generation.

## Public

- `GET /destinations` --- region, interest, season, pagination.
- `GET /destinations/:slug` --- canonical entity + editorial + related
  attractions/experiences/routes/itineraries/food/products/sources.
- `GET /places/:slug` --- place facts, geo, nearby and products.
- `GET /things-to-do` --- destination/category/season/family/duration
  filters.
- `GET /routes/:origin/:destination` --- modes, duration ranges,
  stops, seasonal notes, verification date.
- `GET /itineraries` and `GET /itineraries/:slug`.
- `GET /events`.
- `GET /search` --- q, type, destination, season, geo and grouped
  results.
- `GET /partners` and `GET /partners/:slug`.
- `GET /products` and `GET /products/:slug`.

## Partner

- `POST /partners`.
- `POST /partners/:id/verification`.
- `POST /products`.
- `POST /products/:id/submit`.
- `GET /partner/leads`.
- `POST /travel-requests/:id/quotes`.

## Traveler Lead

- `POST /travel-requests`.
- `GET /travel-requests/:id/quotes` for the owning traveler.

## Admin

- `POST /admin/partners/:id/decision`.
- `POST /admin/products/:id/decision`.

## Rules

Private verification file URLs never appear in public APIs. Sensitive
mutations should support idempotency where useful. Published read APIs
may use cache headers. Every partner/traveler resource is ownership
checked.

Authentication uses verified identity and revocable secure-cookie sessions;
authorization uses PostgreSQL-backed RBAC plus current resource ownership
and partner membership. Deny by default and check in application services,
not just route/UI guards. Staff MFA and consent-before-contact-sharing are
required. See [implementation defaults](../02-architecture/implementation-defaults.md)
for the permission matrix, session policies and quote decision constraints.

## Implemented Sprint 1 destination contract

`GET /api/v1/destinations` and `GET /api/v1/destinations/:slug` are implemented; `/v1/destinations` remains a compatibility alias. Detail includes sourced canonical identity/point/summary/lifecycle, published `editorial.destination` presentation, eligible immediate `geographic_parent`, bounded direct `geographic_children` and eligible sibling `related_destinations`. Unknown/ineligible slug returns 404, malformed filters 422, upstream infrastructure failures a service error. Parameter bounds and publication rules: [destination development contract](../development/destinations.md). This sprint adds no future domain APIs.

## Sprint 2 implemented discovery boundary

[ADR-0018](../adr/0018-attraction-experience-discovery.md) and [discovery setup/contracts](../development/discovery.md) describe the additive canonical Place/Experience fields, approved graph traversal, publication gates, custom CMS EXPERIENCE_EDITORIAL family and SSR public pages. PostgreSQL/PostGIS supplies filtering and symmetric explicitly sourced NEAR distances. Commercial products, OpenSearch and AI remain outside this sprint.
