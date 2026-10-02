# SEO opportunity source and page inventory

Reviewed: 2026-10-02. Authoritative source: [500_Page_Content_SEO_Master.xlsx](500_Page_Content_SEO_Master.xlsx), sheet `500-Page SEO Master`.

Read-only workbook inspection found 500 numbered opportunity rows, 285 distinct proposed URL strings and 145 URL groups appearing more than once. The opportunity row values match [seo-content-master.xlsx](seo-content-master.xlsx); these are copies of the same opportunity set, not another 500 opportunities. The named master takes precedence for future planning. Neither workbook was edited.

No application pages have been implemented, so all 500 opportunity rows remain planning inputs. The 285 distinct URL strings are candidate canonical pages, subject to normalization, editorial quality, source freshness and release scope. Additional opportunities beyond those candidates require research; the workbook does not supply 500 unique pages.

## Inventory process

1. Import the named master read-only into a planning inventory, retaining row ID, cluster, query, intent, type, URL, title/H1, parent entity, related pages, CTA, GEO block, priority, freshness and source strategy.
2. Normalize host/path, slash policy and locale, then group proposed URLs. Assign one stable page/entity owner to each canonical candidate; retain the contributing opportunity row IDs.
3. Consolidate overlapping queries into sections of the same page. Separate a new page only when search intent and sourced content have distinct traveler value; never assign a new URL just to satisfy the number 500.
4. Validate URL family against the entity/landing-page route registry. `/stay/`, `/tour-operators/`, destination package landings and editorial route guides are page projections over existing domain modules, not new business domains.
5. Prioritize P0 within the narrative release scope, then P1/P2. Define readiness as approved entity/facts, editorial coverage, metadata, internal links, media rights and freshness. Preserve unmet opportunities as backlog.
6. Track candidate → researched → ready → published → review-due/withdrawn. Only approved, useful canonical pages enter sitemaps. Compare initial HTML, API projection and search result eligibility after publication.

## Workbook families and domain mapping

| Workbook page type | Canonical ownership / composition |
| --- | --- |
| Destination Guide | Destinations + Geography + Content |
| Things To Do | Experiences/Places directory projection + Content |
| Guide / Seasonal Guide / Adventure Guide | Content referencing approved knowledge/planning entities |
| Directory / Partner Directory | Places or Partners projection with curated landing copy |
| Marketplace | Products + Partners; destination/filter landing distinct from offer detail |
| Itinerary | Itineraries + approved stops/routes + Content |
| Food Guide / Food Entity/Guide | Food + Places + Content |
| Route Guide | Routes + approved route facts or a Content guide referencing them |

Spreadsheet proposed titles/URLs are editorial planning inputs, not proof of rankings, demand, prices or verification. Follow [SEO architecture](seo-architecture.md) and [implementation defaults](../02-architecture/implementation-defaults.md).
