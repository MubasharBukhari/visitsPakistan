# ADR-0009: Standalone Compose deployment with staged scaling

Date: 2026-10-02

Status: Adopted — standalone deployment and recovery targets

## Context

The documented initial deployment is a standalone Linux server. Many infrastructure components compete for memory; team capacity, traffic and service-level commitments are unknown.

## Decision

Start on Ubuntu LTS with Docker Compose, Nginx, CDN/WAF and private dependency networks. Use immutable builds, separate environments, controlled expand/migrate/contract migrations, off-host encrypted backups, external probes and tested restore. Keep Kubernetes and domain microservices deferred. Separate infrastructure/worker resources first when measurements justify it.

## Alternatives

Kubernetes and multi-region orchestration create an avoidable launch burden. Daily dumps alone cannot achieve an hourly DB RPO. Restoring a database as automatic application rollback can destroy new writes.

## Consequences

A single host is a single failure domain. Set DB RPO <=1 hour with WAL/base backups and full service RTO <=8 hours; measure both in restore drills. Public originals use a 24-hour backup target; private verification uploads are copied off-host before submission. Operational policy/retention is in implementation-defaults.md. Rollbacks use compatible prior images; destructive DB changes require later migrations.

## Review triggers and implementation gates

Procure a host/region using audience latency, privacy, budget and load evidence; assign alert coverage during deployment. Prove recovery/load targets before launch. Scale on measured saturation or availability need.

## Validation required before release

Realistic cold/warm-cache load tests, dependency failure drills, migration/image rollback, off-host restore and public-port/edge-bypass checks.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
