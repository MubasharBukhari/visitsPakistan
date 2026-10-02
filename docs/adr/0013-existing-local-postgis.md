# ADR-0013: Reuse the existing local PostgreSQL/PostGIS container

Date: 2026-10-02. Status: accepted — owner instructed reuse of the running Docker database.

## Context

Native PostgreSQL 17 lacked PostGIS. The owner supplied a connection to the existing `vp-postgres` container on localhost:5433. Inspection confirmed PostgreSQL 17.11 and PostGIS availability. This supersedes the native development database portion of ADR-0012.

## Decision

Reuse the existing container without managing its lifecycle through application Compose. Use `visitspakistandb` for development and `visitspakistandb_test` for isolated integration tests. Both were absent and created without changing the existing `visitspakistan` database. Apply only the Sprint 0 PostGIS/platform-marker migration. Store the supplied connection in ignored `.env`.

Host API/Prisma use DATABASE_URL; test migrations explicitly replace its database path to prevent dotenv restoring the primary URL. Compose API clears the host URL and uses DB fields through host.docker.internal:5433. No database resets or replacement containers.

## Consequences and alternatives

PostGIS administrator installation on the native server is no longer a prerequisite. The external container must be running; its lifecycle and volume remain outside this Compose project. Production roles, backups and network access require separate deployment work. Creating a new database service would duplicate the available server.

## Validation

Development and isolated test migrations succeeded. Both live integration tests passed, including readiness against PostgreSQL/PostGIS, Redis and OpenSearch and geography distance SQL.
