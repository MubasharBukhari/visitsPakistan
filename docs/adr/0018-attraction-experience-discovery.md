# ADR-0018: Canonical attraction and experience discovery

Date: 2026-10-03. Status: Accepted under Sprint 2.

Extend the existing Place/Experience owners instead of replacing Sprint 1. Place types add LANDMARK and NATURAL_ATTRACTION; these and ATTRACTION form the public attraction family. Canonical facts remain PostgreSQL columns with nullable unknowns, sourced identity and optional fact-level EntitySource attribution. PostGIS point location remains the single coordinate source. Experiences are seller-independent concepts with no offers, prices, bookings or suppliers.

A Discovery read composition owns approved cross-module projections in one repeatable-read transaction. Public eligibility includes published/nondeleted/verified canonical identity, active non-fixture source, and eligible geographic owner where applicable. Edges need independent eligibility and eligible endpoints. Destination associations derive from approved HAS_ATTRACTION/HAS_EXPERIENCE paths. NEAR reads both orientations of the normalized edge and may display only straight-line point distance. Being geographically close does not assert route access or a NEAR relationship.

Things To Do is a mixed attraction/concept directory. Exact normalized category, season (all-year matches named seasons), explicit family suitability and maximum duration minutes filters use AND; unknown suitability/duration do not satisfy those filters. Destination filtering uses approved graph associations and eligible DestinationProfile identities. PostgreSQL suffices; no search engine is introduced.

EXPERIENCE_EDITORIAL is a new custom CMS family referencing an Experience UUID; attraction editorial references attraction-family Places. Reuse existing block/workflow/media/source/SEO snapshots, without copying canonical hours, admission or coordinates into CMS-owned structured fields. Existing editorial families and snapshots remain valid.

Server-rendered `/places/:slug`, `/experiences/:slug` and `/things-to-do` expose facts, editorial, provenance and eligible graph links. TouristAttraction describes attraction Places; an experience is represented as a Thing, not an Event, commercial offer or scheduled tour. Unsupported schema fields are omitted. Filter URLs are noindexed/canonicalized; missing detail is a real 404 and outages remain service errors. Sitemap discovery includes all implemented public discovery families with a shared 50000 URL limit pending future sharding. Development fixtures never become public approval implicitly.
