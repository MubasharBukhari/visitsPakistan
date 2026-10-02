# Editorial CMS development

Read [local setup](local-development.md) and [ADR-0015](../adr/0015-editorial-cms-workflow.md). Architecture remains under `docs/02-architecture/`.

## Setup

Use the existing authorized PostgreSQL/PostGIS instance on port 5433. Set the ignored `.env` database configuration as described in local setup. Generate a 32-byte hexadecimal `CMS_MFA_KEY` (for example `openssl rand -hex 32`) and keep it secret; changing it invalidates stored TOTP secrets. `MEDIA_ROOT` defaults to `.data/media`. Set `SITE_URL` to the public website origin for published canonical and OpenGraph URLs.

```sh
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:migrate
pnpm db:migrate:test
pnpm cms:bootstrap
pnpm dev
```

Open the CMS at http://localhost:3001 and API Swagger at http://localhost:4000/api/docs. Bootstrap writes new local staff credentials and authenticator enrollment URIs into ignored `.cms-bootstrap.json` with owner-only permissions. Enroll the selected account's TOTP secret in an authenticator and sign in with its password and current six-digit code. Bootstrap preserves existing accounts, themes and content; it refuses production. Do not commit or share this credentials file. A contributor, editor and administrator are provided; the local administrator also explicitly has editor permission.

Compose's optional `apps` profile persists uploads in the `cms-media` volume. Back up media alongside PostgreSQL; a database backup alone does not preserve image files. `.data` and bootstrap credentials are excluded from Docker build contexts.

## Content ownership and retrieval

Editorial families are destination editorial, attraction editorial, travel guide, food guide, route guide, itinerary editorial, collection and travel story. They share author, reviewer, provenance links, verification, publication dates, SEO metadata, hero media and typed blocks. `EditorialDocument.id` references canonical `ContentItem.id`; `EditorialEntityReference.entityId` references `EntityRegistry.id`. Destination/attraction primary references must resolve to the appropriate canonical type. Structured names and identity are projected from the registry, not edited in the CMS.

Protected `/api/v1/admin/content` supports creation, optimistic-version updates and explicit workflow actions. `/api/v1/admin/auth/login` requires password and TOTP; other admin endpoints require a bearer session. Browser requests use the same-origin `/cms-api` BFF, with no bearer token stored in browser JavaScript. `/api/v1/content/:slug?locale=en` returns only published editorial snapshots. `/content/:slug` on the website renders these snapshots with metadata, canonical URL, sources and authors. `/api/v1/presentation` exposes the active validated theme and family template assignments. Media is private until referenced by eligible published content or the active theme.

The seeded `hunza-editorial` is deliberately a draft. Its fixture provenance and unpublished canonical references prevent publication. The CMS can retrieve it after authentication; anonymous retrieval returns 404. Replace fixture sources with reviewed evidence, independently approve canonical data and complete editorial review before publication. Integration tests verify the complete publish/read/edit/withdraw flow using isolated test records; the sample is never silently marked verified.

## Presentation and verification

Tabler Core and Tabler Icons use MIT licenses. Fontsource distributes Playfair Display and Plus Jakarta Sans under SIL Open Font License; copies of upstream notices are retained in `docs/licenses/`; this application imports Tabler CSS and icons, not its bundled third-party chart libraries. Baseline colors are #0D5C3A, #D97736, #0284C7 and #0F172A. The bundled logo recreates the supplied screenshot and must be replaced with the original approved vector before final brand signoff. The Hunza hero is an original illustration, not a destination photograph.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build` and `pnpm format:check`. Integration tests use the separate test database, real NestJS HTTP routes, real password/TOTP authentication, publication isolation and PostgreSQL integrity guards. No partner or travel-product features are introduced. Production onboarding/recovery, persistent local-media configuration and off-host backups, deployment-appropriate login throttling, outbox workers and operational restore testing remain launch prerequisites. S3-compatible storage is optional future work, not a requirement for the approved initial single-server deployment.
