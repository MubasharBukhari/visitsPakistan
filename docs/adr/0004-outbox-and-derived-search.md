# ADR-0004: Transactional outbox and rebuildable OpenSearch

Date: 2026-10-02

Status: Recommended

## Context

Database writes followed by direct Redis/index calls can lose derived updates when a process crashes between operations. Search must never become canonical or resurrect withdrawn content.

## Decision

Commit source changes, audit and outbox rows atomically in PostgreSQL. Poll using worker leases/locking, retry at least once, and deduplicate/version consumers. Redis queues dispatch bounded work; outbox delivery remains recoverable. Build public OpenSearch projections with revision/tombstone handling, canonical eligibility rechecks and alias-based rebuild/catch-up.

## Alternatives

Synchronous dual writes cannot guarantee durable delivery. Kafka/event sourcing would add operations not needed for this scale. Periodic full reindex alone has excessive visibility delay and no reliable notification/invalidation history.

## Consequences

Adds delivery/checkpoint tables and reconciliation jobs. Eventual search/cache consistency is explicit. External side effects need provider idempotency or reconciliation; exactly-once delivery is not promised.

## Review triggers and implementation gates

Define index lag budgets, event retention and rebuild runbook in foundation. Revisit event infrastructure only after throughput/consumer scale demonstrates need.

## Validation required before release

Crash-between-commit-and-delivery, duplicate/reordered event, withdrawal tombstone, queue-loss and concurrent index-rebuild tests.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
