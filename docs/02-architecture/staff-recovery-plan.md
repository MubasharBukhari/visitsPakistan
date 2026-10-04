# Staff password recovery

Implement additive staff reset storage, Auth-owned recovery orchestration, private local/SMTP delivery, anonymous origin-checked CMS BFF routes and responsive forgot/reset pages. Preserve MFA and existing staff roles. Do not change seeded credentials automatically.

A random 32-byte token is stored as a hash, expires after 15 minutes and is consumed transactionally with a fresh TOTP code. Recovery revokes every session, invalidates other reset tokens and audits completion without credentials. Compare the original password hash during reset and sign-in to prevent concurrent old-password sessions. Requests have generic responses, IP limits and durable per-account cooldowns. Delivery is asynchronous and retryable from PostgreSQL; pending tokens are AES-GCM encrypted with the existing staff secret key until delivered. Production requires SMTP; local development writes owner-only files outside served media.

Tests cover token hashing, local delivery, unknown/inactive accounts, expiry, MFA, replay/concurrency, session revocation, audit secrecy, login with new password, BFF origin/anonymous behavior and UI states. Run install, migrations on both existing databases, lint, typecheck, unit/integration tests, build and formatting. Risks: lost MFA requires separately authorized administrator recovery; localhost files are secrets; SMTP inbox ownership/staff provisioning and multi-instance edge throttling remain operational responsibilities.

## Completion evidence

Implemented forgot/reset pages, anonymous origin-checked BFF routes, Swagger endpoints, additive hashed-token/encrypted-delivery storage, cooldowns and per-link attempt bounds, retryable local/SMTP delivery, atomic consumption/MFA proof/session revocation and audit. Twelve migrations are applied to both existing databases. Validation passed lint, typecheck, 83 unit tests, 178 integration tests and all 12 builds. Browser checks covered request success, mismatch/invalid proof, token fragment clearing and 320px/390px responsive layout. SMTP provider delivery remains operationally unverified; no real staff credentials were changed.
