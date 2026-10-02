# ADR-0008: Separate trust, commercial tiers and staged marketplace

Date: 2026-10-02

Status: Adopted — trust separation and explicit marketplace defaults

## Context

Verification cannot be purchased. Sponsored content must not silently alter organic relevance. The release plan validates inquiries/quotes before bookings.

## Decision

Partners owns verification and separate commercial entitlements. Products owns offers/moderation. Organic search and matching exclude commercial tier; sponsored placements are separate labelled blocks. Leads owns requests/consent/matches; Quotes owns immutable sent revisions/decisions. Quote acceptance indicates intent only, with no booking/payment/availability claim. Directory and contact conversion precede the Release 2 portal/request marketplace.

## Alternatives

A single paid/verified flag violates trust rules. Mixing sponsored scores into organic ranks hides commercial influence. Implementing checkout/settlement now adds unvalidated business and operational risk.

## Consequences

Concrete delegated defaults are recorded in implementation-defaults.md: rejection returns to CLAIMED with audited reapplication; only eligible VERIFIED partners match; up to three recipients, fit then fair rotation; consent before contact distribution; 14-day request expiry and default 7-day quotes; one accepted quote per request; no booking/payment effect. Sent snapshots and historical suspended-supplier quotes remain restricted records. Retention is purpose-limited.

## Review triggers and implementation gates

Validate defaults against concurrent requests/acceptance, consent, trust independence and privacy tests. Change matching weights, paid allowances, disclosure or acceptance rules only through a new ADR. Booking/billing remain separate future design work.

## Validation required before release

Paid-tier independence, suspension eligibility, cross-partner privacy, idempotent request/match, quote version/expiry/concurrency and no-booking-side-effect tests.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
