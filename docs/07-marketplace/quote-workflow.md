# VisitsPakistan --- Request-a-Quote Workflow

## Objective

Validate marketplace conversion before payments, inventory and
settlement.

## Traveler Input

Destinations, dates/flexibility, adults/children, departure city,
duration, budget, style/interests, hotel and transport preferences,
requirements, contact and consent.

## Matching

Destination coverage, specialisation/product fit, verification, response
performance, language and operational eligibility. Commercial tier must
not silently manipulate organic match score.

## Workflow

Traveler submits → validation/spam control → eligible partners matched →
lead records created → partners notified → partner opens → quote
created/sent → traveler compares → accepts/declines → lead
won/lost/expired.

## Events

`lead_created`, `lead_distributed`, `lead_opened`, `quote_created`,
`quote_sent`, `quote_viewed`, `quote_accepted`, `quote_declined`,
`lead_expired`.

## Privacy

Only authorized matched partners access a request. PII must not enter
public APIs, logs or analytics payloads. Apply the documented retention/deletion defaults before
production.

## Future

Quote → availability → payment → booking → commission → settlement →
cancellation/refund.

## Implementation Defaults

Traveler drafts may be anonymous, but verified identity is required before
distribution. Match up to three eligible VERIFIED partners using fit then
fair rotation for ties; commercial tier is excluded. Show recipient
identities and obtain consent before releasing contacts or notifying
partners. Requests expire after 14 days; sent quote validity defaults to
7 days, bounded by request expiry. Sent revisions are immutable; one quote
revision may be accepted per request, enforced transactionally. Acceptance
is traveler intent and does not create a booking or reserve availability.

RBAC plus ownership/membership scopes every private operation. Closed
request PII and quote free text are deleted/anonymized after 180 days,
subject to explicit holds. See
[implementation defaults](../02-architecture/implementation-defaults.md)
and [ADR-0011](../adr/0011-implementation-policy-defaults.md).
