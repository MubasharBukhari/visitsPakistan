# ADR-0005: Provider-neutral media with S3 target

Date: 2026-10-02

Status: Adopted — PostgreSQL metadata and local-first media; S3 later

Sprint 0 update: [ADR-0012](0012-sprint-0-platform.md) supersedes the Strapi/separate-CMS-database assumptions, selects pnpm/Nx and makes S3 migration subject to later owner authorization. Canonical domain ownership remains unchanged.

## Context

The owner confirmed PostgreSQL as initial storage. Canonical structured data, sessions and media metadata use PostgreSQL/PostGIS; media file bytes remain behind the existing StorageService. The owner delegated remaining choices, so initial production uses the documented protected local provider with off-host backups and S3 as the later media target.

## Decision

Media owns metadata/access/rights in PostgreSQL. StorageService uses opaque keys and local protected folders initially, then S3-compatible storage when needed. Do not store ordinary image/video/document blobs in application SQL rows. Share the Media boundary with Strapi; private files are never publicly served. Preserve keys/checksums for migration.

## Alternatives

Hardcoded local paths block migration. Direct unrestricted Strapi uploads create conflicting access rules. A new on-host distributed object-store cluster adds operational cost without solving host loss.

## Consequences

Upload quarantine, signature/type validation, scanning, derivative generation and private authorization are required regardless of provider. Local-first can lower initial integration cost but increases host/disk/recovery risk. S3 brings provider/access-policy and ongoing cost decisions.

## Review triggers and implementation gates

Initial media provider is resolved. Verify private off-host copy before submission, public-media backup target, retention jobs and restore in implementation. Select S3 provider only when migrating; create a migration runbook before switching.

## Validation required before release

Private-access denial, signed expiry, malicious-file/quarantine, checksum migration and media restore tests.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
