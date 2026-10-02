# ADR-0007: Explicit public caching and separated Redis policies

Date: 2026-10-02

Status: Recommended

## Context

Public organic traffic benefits from caching; private traveler and verification data must never enter shared caches. Evicting queue state like a disposable cache is unsafe.

## Decision

Cache only approved public projections with locale/schema/filter keys, event invalidation and bounded TTL/stale budgets. Configure Next.js/API/CDN layers explicitly; authenticated/draft/request/quote/verification responses are no-store. Separate evictable Redis cache and persistent no-eviction queue instances. Sessions remain in PostgreSQL. Urgent withdrawal requires canonical eligibility plus purge/edge block as needed.

## Alternatives

One Redis instance with a common eviction policy risks durable work. Unbounded stale-while-revalidate can show withdrawn content. Framework defaults are not a project consistency policy.

## Consequences

More runtime instances, but each has clear resource/durability policy. Cache outage degrades speed with bounded fallback; queue outage leaves durable outbox work. Dependency invalidation and distributed web cache behavior need testing.

## Review triggers and implementation gates

Tune provisional TTLs by source sensitivity/load; agree strict takedown response. Shared invalidation is required before multiple web nodes.

## Validation required before release

Cache-key/private-cookie isolation, cache outage/stampede, publication/withdrawal and durable queue recovery tests.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
