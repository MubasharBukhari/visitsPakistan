# VisitsPakistan --- Release Plan

## Release 0 --- Engineering Foundation

Monorepo, Next.js App Router frontend shell, NestJS API, PostgreSQL/PostGIS,
Redis, OpenSearch, custom CMS, Docker Compose, Nginx, CI/CD, logging,
backups and environment configuration. Exit only when
development/staging/production deployment, migrations, backups and
rollback are reproducible.

## Release 1 --- Authority MVP

Destinations, attractions, things to do, guides, food, routes,
itineraries, search, SEO/GEO, partner directory, tours/packages and
analytics. Target 300--500 useful indexable entities/pages and 30--50
credible founding partners.

## Release 2 --- Conversion Marketplace

Partner onboarding/verification, portal, Request-a-Quote, lead matching,
quote management, WhatsApp/contact tracking and partner analytics.
Target 100+ partners and 300+ products.

## Release 3 --- Growth

Interactive map, events, neighbourhoods, expanded content, affiliate
integrations and clearly labelled sponsorship.

## Release 4 --- Intelligence

Saved trips, personalisation, grounded AI assistant and dynamic
itineraries.

## Release 5 --- Transaction

Availability, payment, booking, commission, settlement and
cancellation/refund only after marketplace economics are validated.

Sprint 0 implements the development workspace, shells, dependency infrastructure
and checks only. Production deployment, authentication, Nginx, backup/restore
and workers remain Release 0 follow-up work; see
[local development](../development/local-development.md).
