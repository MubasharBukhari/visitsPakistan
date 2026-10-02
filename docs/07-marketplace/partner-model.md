# VisitsPakistan --- Partner Model

## Types

DMC, Tour Operator, Guide, Adventure/Trekking Operator, Activity
Provider, Hotel/Guest House, Restaurant, Transport Operator, Car
Rental/Jeep Operator, Event Organizer, Cultural Organization and
approved tourism suppliers.

## Verification

UNCLAIMED → CLAIMED → VERIFICATION_PENDING → VERIFIED → SUSPENDED.
Evidence can include business identity, registration, applicable tourism
license, contacts, operating locations and submitted documents.
Verification cannot be purchased.

Default case policy: rejection returns partner status to CLAIMED with an
audited reason; corrected evidence permits a new case revision. Review
annually or at evidence expiry. Suspension blocks new lead matching,
product publication, quote sending and acceptance. Reinstatement requires
moderator review; products require explicit approval before republishing.
See [implementation defaults](../02-architecture/implementation-defaults.md)
for scoped RBAC and private evidence handling.

## Commercial Tier

FREE / PROFESSIONAL / PREMIUM is separate. It may control product
limits, analytics, lead allowance/pricing and clearly labelled sponsored
placements, but not verification or organic relevance.

## Public Profile

Display name, verification, about, operating since, locations,
specialisations, languages, contacts, website/WhatsApp, products and
policies.

## Product Moderation

Draft → Validation → Pending Review → Published / Changes Requested /
Rejected / Suspended. Automated checks cover missing
itinerary/media/pricing validity/policies/inclusions, duplicates and
suspicious claims.
