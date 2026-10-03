# ADR-0017: Sprint 1 destination editorial and geographic API

Date: 2026-10-03. Status: Accepted under Sprint 1; user explicitly confirmed the existing custom CMS.

Keep the approved custom Next.js/NestJS CMS (ADR-0012/0015). Do not introduce Strapi or a second content store. Add optional structured destination presentation to immutable editorial revisions: quick answer, overview, why visit, best time, travel tips and FAQ pairs. SEO, hero, provenance, author/reviewer and freshness remain existing revision fields. Presentation references the canonical GeoEntity through ContentItem.primaryEntityId; it never owns identity or geography. Legacy revisions remain valid with null presentation.

Retain DestinationProfile (ADR-0016) as the canonical first-class destination concept, sharing Geography UUID identity without relabeling cities. Add optional Geography summary; derive latitude/longitude and GeoJSON Point from PostGIS geography(Point,4326), rather than storing contradictory coordinate columns. Expose immediate eligible parent, bounded direct children and eligible sibling destinations, applying the same source/publication/locale gates as existing public records. Missing intermediate tiers remain legitimate.

Standardize new destination clients on `/api/v1/destinations`; retain `/v1/destinations` as a compatible alias for existing clients. No global prefix change to CMS/health routes. Existing related-domain behavior stays unchanged; Sprint 1 does not implement those owners.

Consequences: one additive migration and backward-compatible DTO fields; PostgreSQL remains the source of truth. Draft seed expansion demonstrates hierarchy without asserting approved travel recommendations. Editorial completion and fact approval remain an explicit content operation, not a seeding side effect.

SEO discovery includes an uncached destination sitemap populated through the same public API gates, robots.txt and llms.txt. Initial sitemap capacity is below 50000 URLs; explicitly fail rather than silently truncate if sharding becomes necessary. English-first discovery uses approved canonical URLs and actual entity/editorial update dates. Future translated sitemaps and a lighter bulk projection can follow measured indexing scale.
