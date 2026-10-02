# Canonical graph implementation plan

Read the actual data directory `docs/03-data/` (the requested `docs/data/` does not exist), approved module boundaries and ADR-0003. Implement Geography, Places, Experiences, Content reference and registry/provenance only. No partner/product models, endpoints, CMS workflows, search indexing or AI.

Use UUID registry identities with shared lifecycle/slug/provenance fields and typed owner records. Composite endpoint FKs prevent orphaned or mistyped graph edges. SQL constraints enforce ordered geographic parents, relation rules, publication prerequisites and immutable identity. PostGIS geography points use meters and GiST indexes; controlled parameterized SQL stays inside the database adapter.

Geographic tiers are COUNTRY, REGION, PROVINCE_TERRITORY, CITY, DESTINATION and NEIGHBOURHOOD. Parents must be a lower tier; levels may be skipped rather than invent cities/regions. Destination geography is implemented here; future discovery profiles remain separate. All nine relation names exist; commerce/cuisine/route endpoint kinds are reserved but cannot be registered until owner tables are introduced in a later migration.

Implement framework-free service/query contracts in domain and a Prisma transaction/repository adapter in database. Seed only deterministic development drafts with fixture provenance, approximate representative points and null last_verified; do not claim editorial approval or current travel facts. Re-running seeds must not overwrite edited records.

Risks: PostGIS fields require raw SQL, registry ownership needs deferred constraints, global per-kind/locale slug reservation survives deletion, and development fixtures are unsuitable for publication. Record decisions in ADR-0014 and document source-review/hierarchy questions.

Tests: service validation/delegation; real repository round trips and proximity, draft/deletion isolation, FK/type/slug/parent/relation constraints, rollback, source publication gates, all hierarchy tiers and seed idempotency. Live tests write only the isolated `_test` database, using rollback transactions and isolated deterministic seed IDs. Run install, schema validation, migrations on development/test databases, seeds, formatting, lint, typecheck, unit/integration tests and all builds.

## Completion evidence

Canonical models, domain draft service, Prisma repository, three additive graph migrations and insert-only seeds are implemented. All four migrations (baseline plus graph migrations) are applied to development and isolated test databases. Development seed was run twice successfully: 11 geography records plus one Place, Experience and ContentItem, all DRAFT, with 17 representative edges.

Frozen-lockfile install and Prisma schema validation passed. Formatting, lint, typecheck, unit tests (26 total), 25 real integration tests, all 12 project builds and Compose validation passed. Prisma migrate status reports up to date. The initial verification trigger used transaction-start time and failed two tests; an additive migration changed it to wall-clock time and regression tests now pass. Final suite has no unresolved failures. No partner/product model, tourism HTTP endpoint, CMS workflow or production deployment was added.

Editorial questions remain documented in ADR-0014: administrative/tourism groupings and Hunza scope, authoritative coordinates/boundaries and taxonomies/freshness. These do not block the draft-only canonical foundation.
