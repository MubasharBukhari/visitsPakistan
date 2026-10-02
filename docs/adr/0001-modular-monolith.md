# ADR-0001: Modular monolith before microservices

Date: 2026-10-02

Status: Recommended; aligned with existing architecture

## Context

Launch targets hundreds of public pages and dozens of partners. Independent service traffic and teams have not been demonstrated.

## Decision

Use one NestJS application with owned modules and one application database. API and worker are separate runtime roles from the same backend release. Keep Next.js, Strapi and infrastructure separately deployable; these containers do not make business domains microservices.

## Alternatives

Microservices per domain would require distributed consistency, network contracts, independent deploys and more on-call operations. An undifferentiated monolith would make later extraction expensive. Both are rejected for launch.

## Consequences

In-process commands and PostgreSQL transactions simplify correctness and delivery. Module ownership/import checks are mandatory. Resource-heavy workers and infrastructure can scale separately before domain extraction.

## Review triggers and implementation gates

Review on measured contention, fault isolation, independent release cadence/team ownership or a stronger availability requirement. Extraction needs a new ADR, contracts, data migration and rollback.

## Validation required before release

Architecture import checks, transaction integration tests and realistic load tests.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
