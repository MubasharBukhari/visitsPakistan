# Implementation defaults

Date: 2026-10-02. Status: adopted architecture defaults under the owner's instruction to resolve remaining questions using engineering judgment. No features implemented.

Next.js, initial PostgreSQL/PostGIS storage and RBAC are owner-confirmed. Other values here are explicit VisitsPakistan design defaults, not claims that another platform has identical policies or that legislation mandates these values. Significant changes require an ADR. Operational evidence and applicable legal requirements are checked before launch; the design is not blocked on another policy questionnaire.

## Platform, storage and release scope

Use Next.js App Router, NestJS modular monolith, PostgreSQL/PostGIS with Prisma plus controlled SQL migrations, a custom CMS presentation over NestJS Content commands, OpenSearch and separate Redis cache/queue instances. PostgreSQL is initial canonical SQL storage for domain data, provenance, sessions, permissions, outbox, audit and media metadata. The custom CMS has no separate backend/database; Content owns future editorial tables in application PostgreSQL. ADR-0012 supersedes the earlier Strapi choice. Images/videos/documents use protected local folders through StorageService initially; S3-compatible media storage requires later owner authorization if traffic/recovery needs justify it. Do not store media binaries in ordinary application SQL rows.

The narrative release plan governs capability order: foundation → authority/directory/products → partner portal/request/quote marketplace → growth/events/maps/sponsorship → grounded AI → eventual booking. Spreadsheet MVP or Release 3 labels do not override it. Necessary moderation/verification exists before public verified-badge claims even if self-service onboarding comes later. Pin supported compatible software versions during foundation; this document does not invent a dependency lockfile.

## Authentication and session policy

RBAC is authorization; authentication establishes the user identity before checking permissions. Use application-owned verified email/password authentication through maintained NestJS/Passport strategies, Argon2id hashing and secure session handling. Support long passwords/password managers and reject known-compromised passwords; do not impose arbitrary periodic password resets. Store password hashes, never plaintext. Email verification and recovery tokens are hashed, one-use and expire after 30 minutes; generic responses prevent account enumeration. Recovery revokes existing sessions after credential replacement.

Opaque sessions are stored in PostgreSQL and delivered in Secure, HttpOnly, SameSite cookies. Enforce CSRF defenses, rotate sessions after authentication/privilege change and revoke on logout/account suspension. Default traveler/partner session: 24-hour idle expiry and 7-day absolute expiry; staff: 30-minute idle and 12-hour absolute expiry. Sensitive account/role/verification actions require recent authentication. Mandatory TOTP MFA with securely stored recovery codes for staff; offer it to partner owners. Use maintained crypto libraries and protect MFA secrets with managed/injected encryption keys.

Anonymous visitors can browse. A traveler may draft a request without registration, but must verify email and establish a request-owning account before distribution or quote access. Do not create anonymous private-resource access from a predictable URL. Partner membership requires an invitation/verified claim; account signup alone does not grant partner permissions. Staff onboarding is explicit; no public admin signup. Mobile OIDC/PKCE is a later design, not a reason to issue long-lived browser bearer tokens now.

These choices apply [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html); expiry durations are project defaults to test and tune.

## RBAC with resource scope

Store roles, permissions and assignments in PostgreSQL. NestJS guards enforce coarse route permissions; application services enforce permissions plus current ownership/membership/status on every resource operation. Deny by default. Roles are not commercial subscription tiers. A user can hold traveler and partner roles; partner roles are scoped to a specific organization. Roles do not grant access to another partner's records.

| Role | Permissions and scope |
| --- | --- |
| Anonymous | Published public reads only |
| Traveler | Own account, requests, private itineraries and quote decisions |
| Partner owner | Own organization profile, member invitations, products, matched leads and quotes; cannot verify own organization |
| Partner manager | Own organization profile/products/leads/quotes; cannot grant owner role |
| Partner agent | Read assigned/matched leads and draft/send permitted quotes; no membership administration |
| Contributor | Create/edit own editorial drafts; no publication or verification |
| Editor | Editorial review/publication and sourced canonical content edits within assigned scope; no verification, entitlement or identity administration |
| Moderator | Partner verification, product moderation and suspension decisions; no commercial trust override |
| Support | Limited assigned case access with audited reason; no bulk private exports by default |
| Administrator | Account/role/configuration administration and explicit moderation permissions; audited access, no automatic bypass of private resource controls |

Prevent self-approval for verification and sensitive role grants; use another authorized staff member. Privileged emergency access is time-limited, reasoned and audited. Custom CMS editorial permissions use the API RBAC scope and do not imply application administrator roles. Membership/role revocation is effective immediately on the next request, independent of cached UI state. This combines RBAC with relationship checks, consistent with [OWASP least-privilege and per-request authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Verification and products

Use existing partner statuses UNCLAIMED → CLAIMED → VERIFICATION_PENDING → VERIFIED, with SUSPENDED available for an operational restriction. Verification cases separately record approved/rejected/changes-requested decisions, reason and reviewer. Rejection returns trust status to CLAIMED; corrected evidence permits a new case. A submitted case is immutable evidence; corrections use a new revision. Publish a badge only for VERIFIED, never based on paid tier. Evidence includes identity/contact verification and applicable registration/license with expiry; do not invent licensing requirements for a partner category. Review annually or at evidence expiry, whichever is earlier, and immediately after material changes/reports. Overdue mandatory evidence suspends the badge/eligibility pending review.

Suspension blocks new product publication, lead matching, quote sending and acceptance. Historical quotes remain visible as unavailable records. Reinstatement requires a moderator decision; affected products require explicit review before republishing. Product moderation is independent of partner trust and price validity. Store supplier-provided amount, currency, per-person/per-group basis, valid dates, inclusions/exclusions and source; PKR is default but currency is always explicit. Do not convert amounts without a dated provider rate or present quoted starting prices as availability guarantees.

## Lead matching and privacy

Verified eligible partners only. Match declared coverage plus relevant specialization/product fit; use language/preference compatibility next. For ties rotate fairly by least recent eligible assignment with stable ID tie-break; collect response-quality evidence before enabling any performance rank signal. Return up to three eligible partners; if fewer exist, show that honestly. Commercial tier neither ranks organic matches nor reduces trust requirements. Do not sell leads or impose paid lead allowances initially.

Require explicit traveler consent for distribution to the displayed matched partners. Initial match views omit phone/email; before a partner is notified and receives contact access, the traveler sees the partner identities and confirms sharing. Restrict request/contact views to the owning traveler, matched partner members and assigned authorized support. Private free-text requirements never enter search or analytics. Cancellation blocks further distribution and contact access except restricted support/audit needs; previously delivered information cannot be technically recalled from a recipient. Rate-limit requests and block duplicates/spam with appealable moderation.

Requests expire after 14 days without acceptance. A traveler can close or cancel earlier; reopening creates a new revision and requires fresh consent if partner recipients change. Matching stores rule version/reasons and consent snapshot. Contact/WhatsApp clickouts are tracked as clicks, not completed messages or bookings.

## Quote decisions

Draft → sent immutable revision → accepted, declined, not selected, expired or withdrawn. Default quote validity is 7 days, bounded by the request expiry; suppliers may set a shorter explicit validity. Revisions do not silently replace a previously sent price. Store decimal line items, explicit currency, totals, inclusions/exclusions and restrictions; compare like-for-like currencies without implicit conversion.

At most one currently accepted quote revision per request, enforced by a transactional/unique constraint; historical decisions remain immutable when a request is reopened. Acceptance requires current validity, matched/eligible supplier, owning traveler and explicit confirmation. Other quotes are marked not selected, with history retained. A changed choice requires audited reopening; it is not an automatic replacement of a commercial agreement. Acceptance is inquiry intent and no booking, capacity reservation or payment guarantee. Notifications and lead outcome updates are idempotent; concurrency tests must exercise two simultaneous accept attempts.

## Data minimization and retention

Optional third-party analytics is disabled until consent. Necessary fraud/security and transactional processing is purpose-limited. Marketing consent is separate from request distribution consent. Do not send contacts, private URLs, query parameters or free text to analytics providers; [Google Analytics prohibits PII collection](https://support.google.com/analytics/answer/6366371?hl=en).

| Record | Default retention / access |
| --- | --- |
| Closed/cancelled/expired request PII and quote free text | Delete or irreversibly anonymize 180 days after closure unless a documented dispute/legal hold applies |
| Rejected verification documents | Delete 30 days after case closure; retain minimal decision metadata |
| Approved verification documents | Delete 90 days after a replacement decision or partner closure; retain current evidence only as needed for annual review |
| Expired recovery/verification tokens and revoked/expired sessions | Purge within 7 days; never retain plaintext secrets |
| Operational logs | 30 days, redacted and access-restricted |
| Security/admin audit metadata | 12 months, with minimal actor/entity/reason fields and restricted access; document bodies excluded |
| Raw pseudonymous product analytics | 90 days; anonymized aggregates up to 13 months |
| DB backups | Daily logical 30 days; weekly base 8 weeks; WAL window at least 7 days |

Deletion jobs are idempotent and audited with IDs/counts, not deleted PII payloads. Object deletion includes originals/derivatives/provider versions under the retention policy. Backups age out separately; after restoring a backup, replay deletion tombstones before reopening access. Legal holds are explicit restricted records, not indefinite retention by default. These are minimization defaults, not legal advice or a compliance claim; verify actual jurisdictional requirements when the business location/provider is known. International rollout requires that review again.

## SEO, locales and facts

English first; locale-aware entity/content/URL records permit Urdu later. Use public content trailing slashes to match the authoritative SEO master; redirect alternate slash forms permanently. API routes keep the existing versioned REST convention. Localized routes add a locale prefix only for an actual launched locale, with one canonical default-English route and genuine hreflang equivalents. Unique canonical route records are owned by entity family/locale; retain redirects when slugs change.

The named [500-page workbook](../06-seo/500_Page_Content_SEO_Master.xlsx) is authoritative for remaining opportunities. Consolidate repeated URL rows, preserving distinct relevant intent sections; new URLs require sourced distinct traveler value, not a page-count quota. See [inventory](../06-seo/opportunity-inventory.md). Curated useful directories are indexable; raw search and arbitrary facets are noindex. Geography supports explicit administrative/tourism relations with reviewed names; do not imply a universal hierarchy or resolve disputed classifications automatically.

Content editors own provenance and review dates. Use official/primary sources where available, dated local confirmations otherwise, and label unknown facts. Source review cadence follows existing SEO policy, with immediate review for visa/closures/transport changes. Live weather/maps require attributed licensed providers and bounded cache; unavailable provider data remains unavailable. No external provider fetch may invent a route duration or visa requirement.

## Operations and procurement defaults

Standalone Ubuntu LTS/Compose/Nginx first, Cloudflare-compatible CDN/WAF interface, private dependency ports, off-host encrypted backups and external uptime checks. Select a Hetzner VM in the lowest-latency available region that passes the audience probes, storage/privacy requirements and budget; provider name/credentials are procurement inputs, not a domain architecture dependency. Start capacity evaluation at the existing 8–16 vCPU/32–64 GB class and validate under realistic load before final sizing.

Adopt initial engineering targets of 99.5% monthly public availability, public HTML/API p95 targets and freshness budgets in system architecture, DB RPO ≤1 hour and full restore RTO ≤8 hours. These are targets until drills/load tests prove them. Public originals have a 24-hour backup target; copy verified private uploads off-host before marking a case submitted. Alert on-call engineering first, escalate to the engineering lead after 15 minutes without acknowledgment. Assign real contacts during deployment; no fictional on-call coverage is implied.

Use a replaceable SMTP/email adapter at launch; evaluate provider deliverability and pricing during setup. WhatsApp remains a consented clickout until an explicit messaging integration is authorized. Payments, affiliate APIs and AI provider selection stay deferred with their releases. Use bounded retries/timeouts and provider reconciliation; vendor downtime never changes verification or canonical facts.

## Required validation

Tests must cover the role/permission matrix, cross-partner ownership, staff MFA/recovery, session revocation, self-approval denial, verification expiry, fair matching without tier inputs, consent-before-sharing, concurrent quote acceptance, retention/deletion after backup restore, and canonical URL consolidation. Real PostgreSQL/PostGIS tests enforce constraints/transactions. Deployment drills prove backup/restore and cache/search/media failure behavior. These tests are future implementation requirements; no production code is part of this update.
