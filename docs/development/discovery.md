# Sprint 2: attraction and experience discovery

See [ADR-0018](../adr/0018-attraction-experience-discovery.md), [Sprint 2 plan](../02-architecture/sprint-2-plan.md), [local development](local-development.md) and [destination setup](destinations.md). Sprint 1 hierarchy and destination profiles remain unchanged. The confirmed custom CMS is used; Strapi is not deployed.

## Setup and seeds

Reuse the existing PostgreSQL/PostGIS container and ignored `.env`. Run `pnpm install --frozen-lockfile`, `pnpm db:migrate`, `pnpm db:migrate:test`, `pnpm db:seed`, then `pnpm cms:bootstrap` to install the additional editorial-family template assignment. Bootstrap and seeds preserve existing edits; bootstrap credentials are written only to ignored local files. Start `pnpm dev:api`, `pnpm dev:web` and optionally `pnpm dev:cms`.

The additive migration extends Place and Experience, retains their registry UUIDs and geography(Point,4326)/GiST index, and adds category/family/duration and season indexes. Slugs remain unique by registry kind/locale, with timestamps, soft deletion, publication status and source ownership inherited from EntityRegistry. Experience concepts remain independent of commercial TravelProducts.

CMS bootstrap also creates insert-only Attabad Lake attraction and boating experience editorial drafts, each referencing its canonical UUID. They retain null verification and fixture provenance, so publication is blocked until independently reviewed evidence replaces the fixtures.

Eight representative attraction Places are available as drafts: Attabad Lake, Baltit Fort, Passu Cones, Deosai, Badshahi Mosque, Lahore Fort, Faisal Mosque and Margalla Hills. Concepts cover boating, trekking, food walk, heritage tour, photography, camping and skiing. Draft edges connect destinations, places and concepts, including a normalized symmetric NEAR example. Coordinates are approximate development fixtures; hours, admission, suitability, duration and verification are not fabricated. Idempotent seed does not republish or overwrite edited entities. Production readers exclude these unverified, fixture-backed records.

For populated local verification without approving real tourism facts, stop the normal API, then run `pnpm discovery:preview` and `pnpm dev:web`. Preview refuses production configuration and requires a separate `_test` database. It prints synthetic Hunza, attraction, experience and directory URLs. Stop it normally to withdraw its published fixtures, retire their sources and remove temporary media. Do not run integration tests concurrently with preview; both temporarily assign CMS templates in the isolated database. Abrupt termination can bypass cleanup.

## Canonical models and editorial boundary

Place supports ATTRACTION, LANDMARK, NATURAL_ATTRACTION and future RESTAURANT/HOTEL/MARKET/VENUE/TRANSPORT_POINT types. This sprint exposes only the attraction family publicly. Alternate names, summary, geographic owner, PostGIS point, opening/admission information, recommended duration, best-time text, season tags, nullable family suitability, accessibility and facilities belong to the canonical Place. Unknown nullable facts are displayed as unverified; missing facilities/seasons are not inferred.

The CMS Attraction editorial family requires the canonical Place UUID and rejects other Place types. Experience editorial requires an Experience UUID. Use the canonical picker, sourced typed content blocks, hero, SEO fields, author/reviewer and freshness. Follow draft → review → approved → published with a different reviewer. CMS snapshots own presentation; changing a draft never replaces the currently published revision. Canonical names/coordinates/hours are not copied into CMS structured fields. Template settings require every editorial family exactly once, including the ninth EXPERIENCE_EDITORIAL family.

## REST and graph semantics

Swagger documents:

- `GET /api/v1/places/:slug`: canonical attraction, optional published editorial, geographic owner, connected destinations/experiences, explicitly asserted nearby attractions, sources and verification.
- `GET /api/v1/experiences/:slug`: independent canonical concept, optional editorial, geographic owner where assigned, connected places/destinations and provenance.
- `GET /api/v1/things-to-do`: mixed public attraction/concept cards, stable name/UUID pagination and public locale facets.

Directory parameters: `destination` (eligible canonical destination slug), `category` (normalized lowercase hyphenated category), `season` (spring/summer/autumn/winter/all-year), `familySuitable` (true/false), `duration` (maximum recommended duration in minutes, 1–10080), optional `kind` (place/experience), `page` (1–10000), `pageSize` (1–48, default 12), `locale` (default en). Filters combine with AND. Unknown suitability/duration do not match an explicit filter. All-year matches named seasons. Unsupported/unknown API query keys return 422. Empty results return 200 with totals and facets; missing or unpublished detail returns 404; infrastructure failures are not converted to missing entities.

Destination filtering follows approved Destination HAS_ATTRACTION Place and Destination HAS_EXPERIENCE Experience edges, including Destination → Place → Experience paths. Geographic ownership alone does not invent a discovery edge. Duplicate direct/indirect associations are deduplicated. Place HAS_EXPERIENCE is traversed in both directions for detail navigation. NEAR is read symmetrically and only for independently published, sourced edges; `distance_meters` is PostGIS straight-line distance or null, never road distance or travel time. Public identity, geographic owner, profile and edge provenance are gated independently. Related lists are bounded (48 destinations/nearby places, 100 concept/place links).

## Public website and SEO

`/things-to-do/`, `/places/:slug/` and `/experiences/:slug/` render meaningful HTML on the server. Destination pages automatically link eligible canonical attraction/experience relationships. Cards, GET filters, responsive details, sources/freshness, empty/error/loading states and real missing-page 404s are included. Details have canonical/OpenGraph metadata and matching breadcrumb JSON-LD. Attraction Places use TouristAttraction; independent concepts use Thing without invented event schedules or offers. Filter variants are noindexed and canonicalized to the directory. Set `SITE_URL` to the public origin.

Sitemap includes published English destinations, attractions and experiences with actual update dates; robots and llms files point to public discovery. Shared sitemap size is guarded at 50000 URLs; introduce sharding and a bulk identity projection before reaching that scale. No OpenSearch, commercial marketplace, AI planner or maps UI is implemented.

## Verification and remaining governance

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm format:check`. Tests cover source/owner/edge withdrawal, typed CMS mapping and immutable publication, PostGIS point/distance, symmetric NEAR, destination associations, AND filters, bounded pagination, missing pages, SSR metadata/internal links and empty states. Browser verification uses isolated synthetic records for Destination → Attraction → Experience.

Real operating/accessibility/admission evidence and a governed category vocabulary are still required before production publication. Recommended duration is editorially sourced discovery guidance, not an itinerary or purchasable offer. No accessibility or family suitability guarantee is inferred from a boolean tag.
