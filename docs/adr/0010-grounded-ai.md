# ADR-0010: Defer AI until approved data supports grounded retrieval

Date: 2026-10-02

Status: Recommended future boundary; not an implementation commitment

## Context

AI must not invent routes, times, prices, partners, hours, availability, events or visa requirements. The narrative roadmap places intelligence after core discovery and marketplace.

## Decision

Defer AI implementation to Release 4. Future AI orchestration retrieves only approved entity/fact/source projections, validates freshness and permission, checks structured output IDs/claims and cites provenance. Start with read-only tools. Unknown facts are unavailable; generated plans remain unpublished drafts. Saves and requests use normal authorized user-confirmed commands.

## Alternatives

General web/model memory as authoritative travel advice breaks grounding. Autonomous publication/partner verification/payment is outside scope. A vector store or separate AI service is not needed before retrieval quality is measured.

## Consequences

Data quality and evaluation sets are prerequisites. Provider privacy, retention, cost limits, prompt-injection defenses and provenance need concrete review later. The narrative release plan governs: differing workbook labels do not accelerate AI scaffolding.

## Review triggers and implementation gates

Create provider/retrieval ADRs at the intelligence release; evaluate lexical retrieval first and add vectors only with measured benefit.

## Validation required before release

Unsupported-fact refusal, freshness, fake-ID rejection, cross-user denial, prompt-injection, grounding/citation and tool-permission evaluations.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
