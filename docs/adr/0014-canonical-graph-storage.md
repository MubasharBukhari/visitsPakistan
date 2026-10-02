# ADR-0014: Typed canonical graph with shared UUID identities

Date: 2026-10-02. Status: accepted for the requested canonical graph implementation.

## Context

The owner requested GeoEntity, Place, Experience, ContentItem, EntityRelation and SourceRecord, hierarchy, provenance, PostGIS proximity, migrations and seeds. Approved ADR-0003 requires FK-backed registry endpoints rather than unchecked polymorphic IDs. Data specs are in `docs/03-data/`; no `docs/data/` exists. Custom CMS ownership follows ADR-0012.

## Decision

Add a minimal `EntityRegistry` with UUID, kind, name, per-kind/locale slug, publication lifecycle, timestamps, soft deletion, primary source, verification date and provenance metadata. The four concrete owner models share its UUID through composite identity/kind FKs. Deferred database constraints require a corresponding implemented owner at commit; kinds/identities and geographic tiers are immutable. Registry is common identity infrastructure, not a CMS or domain orchestrator. `EntitySource` supports fact-level multi-source attribution, confidence, reviewer and verification date. Source records are retained with optional retirement; FKs restrict hard deletion.

Parent geography uses typed FKs with strictly increasing tiers, allowing gaps. This prevents cycles without serializing all geography writes and avoids fabricating parents merely to fill every level. Hunza is a destination under Gilgit-Baltistan; Skardu/Islamabad/Lahore/Karachi are cities. Provinces and territories share a tier without asserting identical legal status. `Northern Pakistan` is an explicitly unverified editorial region grouping. Destination discovery profiles remain future domain-owned records referencing destination geography.

All nine relation types are supported in the enum/type matrix. Canonical endpoint kinds include reserved CUISINE, ROUTE, PARTNER and TRAVEL_PRODUCT labels; registry constraints reject those owners until their tables arrive in a reviewed future migration. No partner/product functionality is implemented. `PART_OF` edges must agree with typed geographic ownership. Reparenting must coordinate existing active edges in the same transaction. NEAR is symmetric, stored once in ascending UUID order, and makes no travel-time assertion. Weight is an optional bounded relevance/confidence value, not sponsored ranking.

Use nullable PostGIS `geography(Point,4326)` for representative entity/place locations. GiST indexes support ST_DWithin in meters; the adapter uses parameterized SQL and projects scalar coordinates/distance rather than returning unsupported columns to Prisma. Points are not administrative boundaries or travel routes. Domain service validates UUIDs, slugs, coordinates, query bounds and relation directions; Prisma adapter coordinates serializable transactions. Serialization conflicts require caller retry; there are no external side effects or HTTP commands in this change.

Commands create drafts only. Published database rows require an active non-fixture source and last_verified; soft-deleted entities/edges must be WITHDRAWN. Public proximity/edge queries filter publication/deletion and retired provenance, including endpoint/owner eligibility. These are minimum integrity gates; full editorial review, freshness thresholds, RBAC/audit/outbox and publication commands remain future work. ContentItem stores reference metadata and canonical links, not CMS composition or bodies.

Seed deterministic UUIDs and insert-only development drafts, with fixture provenance and approximate points. Fixture sources cannot satisfy publication. Seed twice must not overwrite existing entity edits or revive withdrawn records. Production seed command is refused. Existing databases and seed identities are never reset.

## Alternatives and consequences

Unchecked `(type,id)` edges were rejected because they allow orphans. CMS-only entities were rejected because canonical facts must be reusable independently. A dedicated graph store adds operational complexity. Duplicating lifecycle fields in each owner would multiply common invariants; shared identity fields use module service ownership instead. Per-kind/locale slug reservations survive soft deletion and avoid accidental URL takeover; redirects/translations remain later work.

Prisma schema does not fully express triggers/checks/spatial indexes. Controlled SQL migrations are authoritative for those invariants; review and preserve them in future migrations. Registry and owner must be inserted together in a transaction. Three additive graph migrations were applied in order without editing an applied migration. Extension remains managed by the baseline.

## Validation and open questions

Unit service tests and real isolated PostgreSQL repository tests cover hierarchy tiers, provenance/publication gates, symmetric edges, typed FKs, transaction rollback, slug/edge uniqueness, idempotent seeds, spatial meters and draft/deletion filtering. Existing platform checks continue to run.

Before real editorial import: approve region groupings and Hunza's exact geographic scope; obtain authoritative point/boundary sources and multilingual aliases; define reviewed category/difficulty/season taxonomies and field-specific freshness. Seed values do not resolve these editorial questions. Future partner/route/cuisine owner migrations must extend owner integrity and relation rules explicitly.

## References

[Module boundaries](../02-architecture/module-boundaries.md), [implementation plan](../02-architecture/canonical-graph-plan.md), [Prisma Unsupported fields](https://docs.prisma.io/docs/orm/reference/prisma-schema-reference), [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html), [PostgreSQL deferred constraint triggers](https://www.postgresql.org/docs/17/sql-createconstraint.html).
