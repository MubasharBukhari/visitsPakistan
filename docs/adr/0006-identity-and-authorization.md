# ADR-0006: Central identity and object-level authorization

Date: 2026-10-02

Status: Accepted RBAC; adopted authentication/session defaults

## Context

The owner requested RBAC for authentication/authorization. RBAC grants permissions after authentication; it does not establish identity. Users include travelers, organization-scoped partner members, contributors/editors, moderators, support and administrators. Resource scope must prevent cross-partner access.

## Decision

Use PostgreSQL-backed roles, permissions and scoped bindings, deny-by-default NestJS guards and application ownership/membership checks. Authenticate with verified email/password, maintained NestJS/Passport strategies, Argon2id and opaque PostgreSQL-backed secure-cookie sessions. Require staff MFA, CSRF protection, rotation/revocation and one-use hashed recovery tokens. Guest drafts require verified identity before distribution. Role matrix and expiry defaults are in implementation-defaults.md; no external identity provider is required initially.

## Alternatives

Long-lived browser tokens without revocation and client-only route guards are insufficient. Reusing Strapi users as the canonical traveler/partner model couples domains and privilege scopes. Custom cryptography is rejected.

## Consequences

RBAC never replaces resource ownership or current eligibility. Redis eviction cannot revoke authoritative sessions. Commercial tier and verification are unrelated to identity roles. Strapi staff roles are separate from application administrator privileges.

## Review triggers and implementation gates

Implement/test the documented role/session/recovery defaults. Native clients may later require OIDC/PKCE under a new ADR; external login does not alter canonical user/membership ownership.

## Validation required before release

Cross-tenant denial, membership revocation, session rotation/expiry, CSRF, rate-limited recovery and privileged MFA tests.

## Related documents

[System architecture](../02-architecture/system-architecture.md), [module boundaries](../02-architecture/module-boundaries.md), [deployment architecture](../02-architecture/deployment-architecture.md), [ADR index](README.md), [implementation defaults](../02-architecture/implementation-defaults.md).
