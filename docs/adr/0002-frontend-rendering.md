# ADR-0002: Next.js and public server-rendered HTML

Date: 2026-10-02

Status: Accepted — owner confirmed Next.js on 2026-10-02

## Context

Earlier planning documents selected Vite while AGENTS.md specified Next.js. The owner explicitly selected Next.js on 2026-10-02. Existing frontend/release/SEO/infrastructure documentation is now reconciled; no frontend application existed to migrate. This records the resolution rather than leaving a competing baseline.

## Decision

Use Next.js App Router with strict TypeScript as the sole frontend. Public stable pages use static generation/revalidation; volatile published pages use server rendering; private pages are dynamic and uncached. NestJS remains the business API. No frontend confirmation is outstanding.

## Alternatives

Vite SSR/prerendering was the earlier documented alternative and is superseded. Client-only rendering of primary public travel pages does not satisfy initial-HTML requirements.

## Consequences

Next.js supplies a coherent rendering/metadata path while requiring deliberate cache and self-hosting configuration. No working frontend is rewritten. Do not scaffold both frontend frameworks.

## Review triggers and implementation gates

Pin supported compatible versions and prove publish/withdrawal cache behavior during Release 0. Changing frontend direction requires a superseding ADR.

## Validation required before release

Raw-HTML metadata/content tests, correct status/redirect tests, mobile performance and cache isolation tests.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
