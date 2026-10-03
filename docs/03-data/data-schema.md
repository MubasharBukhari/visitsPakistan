# VisitsPakistan --- Data Schema

## Core

PostgreSQL + PostGIS; Prisma for application models with controlled SQL
migrations for PostGIS-specific features.

## Main Tables

- `geo_entity`: type, name, slug, parent, alt_names, PostGIS geom,
  timezone, status, last_verified.
- `place`: physical POI with type, destination, coordinates, facts,
  publication status and freshness.
- `experience`: non-seller experience concept with category,
  difficulty, duration and seasons.
- `content_item`: editorial reference with CMS external ID, primary
  entity and publication metadata.
- `entity_relation`: generic knowledge-graph edge.
- `source_record`: URL/title/publisher/accessed_at/source_type.
- `partner`: legal/display name, type, verification_status,
  commercial_tier.
- `partner_location`: supplier service coverage.
- `travel_product`: EXPERIENCE/TOUR/PACKAGE, partner, destination,
  duration, price, booking type and moderation status.
- `product_destination`, `product_day`, `product_day_stop`: structured
  multi-day products.
- `route`, `route_mode`, `route_stop`: origin/destination, modes,
  times, stops and seasonal notes.
- `itinerary`, `itinerary_day`, `itinerary_stop`: curated/generated
  plans.
- `event`: venue, destination, organizer, start/end and category.
- `traveler_request`, `lead_match`, `quote`, `quote_item`: lead
  marketplace.
- `audit_log`: actor/action/entity/before-after metadata/timestamp.

## Critical Rules

`verification_status` = UNCLAIMED, CLAIMED, VERIFICATION_PENDING,
VERIFIED, SUSPENDED. `commercial_tier` = FREE, PROFESSIONAL, PREMIUM.
They are independent.

## Ownership

Application DB owns canonical travel and marketplace data. The custom CMS
is presentation over NestJS-owned editorial composition/workflow (ADR-0012). OpenSearch is derived and rebuildable.

## Initial Storage and Authorization

PostgreSQL/PostGIS is confirmed as initial canonical SQL storage. Identity
owns users, credential hashes, revocable sessions, roles, permissions, role
bindings and organization-scoped memberships. Media metadata/object keys
live in PostgreSQL; file bytes use protected local StorageService folders
initially and S3 later. Enforce one accepted quote revision per request
transactionally and retain immutable sent revisions. Detailed policies:
[implementation defaults](../02-architecture/implementation-defaults.md).

## Implemented canonical foundation

[ADR-0014](../adr/0014-canonical-graph-storage.md) defines the implemented schema. Shared `entity_registry` owns UUID identity, kind, name, locale/slug, publication status, created/updated/deleted timestamps, primary source, provenance metadata and `last_verified` for GeoEntity, Place, Experience and ContentItem. These are fields of every entity through its one-to-one identity, not duplicated columns. `entity_source` adds fact-path attribution and reviewer/confidence/verification metadata. SourceRecord uses `retired_at` rather than removing evidence.

`geo_entity` and `place` have nullable geography(Point,4326) plus GiST indexes; controlled SQL migration constraints enforce typed graph endpoints, reserved unimplemented owners, parent tiers and publication prerequisites. Slugs are unique per entity kind and locale, including withdrawn/deleted records. No partners or travel products are implemented. See [plan](../02-architecture/canonical-graph-plan.md) and [development commands](../development/local-development.md).

## Sprint 1 geography and destination presentation

Geography adds optional canonical `summary`; identity/lifecycle still lives in `entity_registry`. Point geography remains SQL-owned, with latitude/longitude and GeoJSON derived for public DTOs. DestinationProfile shares the GeoEntity UUID and owns sourced discovery facets independently of editorial. `editorial_revision.destination` is optional presentation JSON for quick answer, overview, why visit, best time, travel tips and FAQ pairs, protected by submitted/published snapshot immutability. See [ADR-0017](../adr/0017-sprint-1-destination-editorial-geography.md).

## Sprint 2 implemented discovery boundary

[ADR-0018](../adr/0018-attraction-experience-discovery.md) and [discovery setup/contracts](../development/discovery.md) describe the additive canonical Place/Experience fields, approved graph traversal, publication gates, custom CMS EXPERIENCE_EDITORIAL family and SSR public pages. PostgreSQL/PostGIS supplies filtering and symmetric explicitly sourced NEAR distances. Commercial products, OpenSearch and AI remain outside this sprint.
