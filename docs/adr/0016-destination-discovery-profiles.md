# ADR-0016: Canonical destination discovery profiles and public composition

Date: 2026-10-02. Status: Accepted under the destination vertical request.

Add a Destinations-owned profile keyed by existing GeoEntity UUID; eligible geography types are DESTINATION and CITY. This supports Hunza and Skardu without duplicating canonical identity or relabeling cities. Profile interest/season tags carry their own source, verification, publication lifecycle and soft deletion. Identity, slug, coordinates and geographic hierarchy remain Geography-owned. Profiles are independent of CMS presentation.

Public reads require both profile and geographic identity to be published with active non-fixture provenance. Region means a published REGION or PROVINCE_TERRITORY ancestor slug, including nested descendants. Interest uses exact normalized tags; season uses explicit spring/summer/autumn/winter/all-year tags, with all-year matching each named season. Unreviewed geographic groupings are never exposed as approved navigation. Stable name/UUID ordering and bounded offset pagination suffice initially; PostgreSQL recursive queries and indexed facet arrays avoid a premature search dependency.

NestJS exposes the requested `/v1/destinations` contract. Existing CMS `/api/v1` endpoints retain their paths. The Destinations reader composes approved Content projections within a repeatable-read transaction, alongside canonical relations; published snapshots stay separate from drafts. Structured routes/itineraries/cuisines/travel products return empty arrays until those owning modules exist. Editorial guides are explicitly separate from structured entities. No marketplace code is introduced.

Next.js uses SSR/no-store for immediate withdrawal visibility. Public detail metadata and JSON-LD derive exclusively from approved response fields. Filter/page variants canonicalize to `/destinations/` and are noindexed. No default season claims, synthetic prices, times or products are emitted. Development seed profiles remain drafts; Hunza/Skardu publication is verified with isolated synthetic test records, not promoted production fixtures.

Consequences: destination reads depend on Geography/Content query boundaries and PostgreSQL, while Redis/OpenSearch remain optional future derived layers. Interest vocabulary approval and source freshness remain data-governance decisions. Offset pagination can be replaced with a cursor when measured scale warrants it.
