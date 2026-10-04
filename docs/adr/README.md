# Architecture decision records

Date: 2026-10-02. Next.js, initial PostgreSQL storage and RBAC are owner-confirmed. Remaining design choices use delegated engineering defaults in ADR-0011 and implementation-defaults.md. The former Vite and initial-media questions are resolved; ADRs retain their decision context. These records do not claim application implementation, deployment or benchmark results.

| ADR                                            | Decision                                                               | Status                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| [0001](0001-modular-monolith.md)               | Modular monolith before microservices                                  | Recommended; aligned with existing architecture               |
| [0002](0002-frontend-rendering.md)             | Next.js and public server-rendered HTML                                | Accepted — owner confirmed Next.js                            |
| [0003](0003-canonical-data-and-cms.md)         | Canonical travel data outside CMS                                      | Recommended; elaborates existing data ownership               |
| [0004](0004-outbox-and-derived-search.md)      | Transactional outbox and rebuildable OpenSearch                        | Recommended                                                   |
| [0005](0005-media-storage.md)                  | Provider-neutral media with S3 target                                  | Adopted — PostgreSQL metadata, local media first, S3 later    |
| [0006](0006-identity-and-authorization.md)     | RBAC, authenticated identity and resource authorization                | Accepted RBAC; adopted authentication/session defaults        |
| [0007](0007-caching-and-private-data.md)       | Explicit public caching and separated Redis policies                   | Recommended                                                   |
| [0008](0008-marketplace-trust-and-quotes.md)   | Separate trust, commercial tiers and staged marketplace                | Adopted — explicit marketplace defaults                       |
| [0009](0009-deployment-and-recovery.md)        | Standalone Compose deployment with staged scaling                      | Adopted — deployment and recovery targets                     |
| [0010](0010-grounded-ai.md)                    | Defer AI until approved data supports grounded retrieval               | Recommended future boundary; not an implementation commitment |
| [0011](0011-implementation-policy-defaults.md) | Delegated implementation, marketplace, privacy and SEO defaults        | Adopted architecture defaults                                 |
| [0012](0012-sprint-0-platform.md)              | Sprint 0 pnpm/Nx workspace, custom CMS and native database development | Accepted; supersedes Strapi runtime/layout choices            |

| [0013](0013-existing-local-postgis.md) | Reuse existing Docker PostgreSQL/PostGIS on port 5433 | Accepted; supersedes native development database topology |

| [0014](0014-canonical-graph-storage.md) | Typed UUID knowledge graph, ordered geography, provenance and PostGIS | Accepted; implements registry contract and canonical foundation |

Future significant changes require a new or superseding ADR identifying context, decision, alternatives, consequences, validation and review trigger. Implementation must not silently change these boundaries.

Sprint 3: [ADR-0019](0019-derived-unified-search.md) — derived unified search with versioned aliases, coalesced durable delivery and canonical eligibility filtering (Accepted).

[ADR-0020](0020-staff-password-recovery.md) — email-token and MFA staff password recovery (Accepted).
