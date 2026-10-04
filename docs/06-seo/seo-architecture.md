# VisitsPakistan --- SEO & GEO Architecture

## Next.js Rendering Requirement

Frontend is Next.js App Router + TypeScript. Primary public content must **not** be
client-only SPA rendering. Use Next.js SSR or static
generation/revalidation so title, H1, main copy, canonical,
structured data, breadcrumbs and internal links exist in initial HTML.

## Indexable Families

`/destinations/:slug`, `/places/:slug`, `/things-to-do/...`,
`/experiences/:slug`, `/food/:slug`, `/guides/:slug`, `/routes/:slug`,
`/itineraries/:slug`, `/events/:slug`, `/partners/:slug`, `/tours/...`,
`/packages/...`.

## Technical Requirements

Canonical URLs; sitemap index split by page family; robots.txt; llms.txt; correct
HTTP status; permanent redirects; breadcrumbs; OpenGraph; image
dimensions/alt; controlled pagination; noindex for thin faceted
combinations; fast mobile rendering; structured data only when matching
visible content.

## GEO Content Pattern

Direct answer; quick facts; explicit entity names/relationships;
original local information; sources; author/reviewer; last
updated/verified; related entity links. use llms.txt to list pages for GEO following standart strucutre.

## Quality

The authoritative [500-page master](500_Page_Content_SEO_Master.xlsx)
contains 500 opportunities and 285 distinct proposed URL strings. Its
opportunity rows match the older `seo-content-master.xlsx`; do not count
the two copies as additional pages. It is an opportunity backlog, not
permission to generate thin keyword pages. Consolidate the 145 repeated
URL groups and normalize trailing slashes before creating canonical pages.
Use every row as an intent/content requirement within the consolidated
page; do not manufacture missing pages to reach the filename count. Each page needs distinct traveler value and
sufficient sourced information.

## Freshness

Monthly/in-season for roads/events/opening info/prices; quarterly for
high-intent planning and partner/product data; annual/event-driven for
stable background; immediate review for visa, closures and major
transport changes.

## Pipeline

Publish canonical entity/content → enqueue index update → build
OpenSearch document → refresh affected sitemap/internal-link caches.

## KPIs

Organic landing sessions, engaged organic sessions, indexed quality
pages, query clusters, search CTR, identifiable AI referrals,
content-to-product progression and commercial actions.

## Sprint 3 unified search

[ADR-0019](../adr/0019-derived-unified-search.md) and [search development/contracts](../development/search.md) define the implemented OpenSearch aliases, durable PostgreSQL change marker/manifests, current eligibility filtering, grouped `/api/v1/search`, autocomplete and SSR/noindex search page. PostgreSQL remains canonical; commercial/future families are not indexed.
