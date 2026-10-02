# VisitsPakistan --- Pakistan Travel Knowledge Graph

## Goal

Represent Pakistan travel information as connected reusable entities so
web, search, maps, marketplace and future AI consume the same trusted
data.

## Entity Families

**Geography:** Country → Region → Province/Territory → City →
Destination → Neighbourhood.\
**Places:** attraction, restaurant, hotel, market, venue, transport
point.\
**Experiences:** trekking, boating, food walks, heritage visits,
photography and other experience concepts.\
**Content:** guide, story, collection.\
**Commerce:** partner, travel product, tour, package, lead, quote.\
**Planning:** route, itinerary, event and seasonal facts.

## Example

Hunza →
HAS_ATTRACTION → Attabad Lake → HAS_EXPERIENCE → Boating. Partner XYZ →
OPERATES → 5-Day Hunza Tour → VISITS → Hunza.

## Generic Relation

`entity_relation(id, source_kind, source_id, type, target_kind, target_id, weight, metadata, status, source_record_id, last_verified, created_at, updated_at, deleted_at)`. Composite endpoint FKs reference UUID/kind registry identities. Administrative containment uses parent FKs and matching PART_OF edges; inverse containment is derived rather than introducing HAS_REGION/HAS_DESTINATION relation names.

## Provenance

Important travel facts store source, publisher, access date, last
verified, reviewer where relevant and optional confidence/verification
level. Routes, permits, visa, opening hours, prices and seasonal access
require stricter freshness.

## AI Rule

AI retrieves approved entities/content and references retrieved entity
IDs/source records. Missing verified facts are reported as unavailable,
never invented.

## Foundation status

The canonical models and representative development drafts are implemented under [ADR-0014](../adr/0014-canonical-graph-storage.md). All nine requested relation names are defined; cuisine/route/commerce endpoint kinds are reserved and cannot be registered until their owning tables are implemented. Place/Experience are independent canonical concepts, not commercial offers. ContentItem is a linked editorial reference only. Seeds are unverified development fixtures and are excluded from public queries. Ordered tiers may skip intermediate levels; no fabricated parent entities are required.
