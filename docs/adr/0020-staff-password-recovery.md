# ADR-0020: Email-token and MFA staff password recovery

Status: Accepted. Date: 2026-10-04.

CMS staff can forget passwords without disabling their second factor. Use a single-use 15-minute random email token plus a fresh enrolled TOTP code. PostgreSQL owns hashed tokens and a retryable encrypted delivery queue. Reset atomically consumes proof, changes the Argon2id hash, revokes sessions, invalidates other links and records an audit. Login also compares the verified password hash in its transaction to prevent an in-flight old-password session surviving recovery.

Local development saves owner-only messages outside public storage; production uses authenticated TLS SMTP and never falls back to local files. Request responses do not reveal account existence or delivery outcomes. Trusted CMS_ORIGIN constructs links, with tokens in fragments to avoid server URL logs/referrers. Recovery never signs users in automatically and does not reset MFA or roles. Existing generated bootstrap passwords are not universal defaults and become stale after reset.

Operational consequences: configure SMTP and MFA encryption keys before enabling production recovery; failed delivery retries until link expiry. Single-node IP throttling complements durable account cooldowns; use an edge/shared limiter when scaled. Encrypted queue payloads are cleared after delivery/expiry. SMTP delivery is at-least-once and can duplicate a message following process failure, but reset consumption is single-use. Lost email/MFA needs separate identity-verified staff support. Review aligns with [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
