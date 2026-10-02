# ADR-0003: Canonical travel data outside CMS

Date: 2026-10-02

Status: Recommended; elaborates existing data ownership

Sprint 0 update: [ADR-0012](0012-sprint-0-platform.md) supersedes the Strapi/separate-CMS-database assumptions, selects pnpm/Nx and makes S3 migration subject to later owner authorization. Canonical domain ownership remains unchanged.

## Context

The knowledge graph must serve web, search, planning and future AI independently of editorial composition. Existing generic relation endpoints do not alone enforce typed referential integrity.

## Decision

Application PostgreSQL/PostGIS owns typed domain entities, sources/fact freshness, localized URLs and a minimal entity registry with validated FK-backed relation endpoints. Destination profiles reference geography. Strapi uses a separate DB/credential and owns editorial composition/workflow. Content imports approved sanitized snapshots with external revision IDs for public delivery; direct CMS publication cannot bypass domain gates.

## Alternatives

CMS-only canonical models lock business data into editorial tooling. A graph database adds unnecessary operations. Unchecked polymorphic relations permit orphaned/invalid edges. Reject all three at launch.

## Consequences

Public rendering survives CMS downtime. Editorial and structured facts need clear authoring interfaces, validation and reconciliation. Domain and CMS migrations are separate. Registry complexity is deliberately small; critical associations remain typed FKs.

## Review triggers and implementation gates

Use reviewed administrative/tourism relations and sourced fact gates from implementation defaults; validate detailed schema constraints during implementation. CMS media/reference plugin must be validated; direct DB sharing is prohibited.

## Validation required before release

FK/endpoint-type/cycle tests, migration tests, stale source checks, draft isolation and duplicate/out-of-order webhook tests.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
