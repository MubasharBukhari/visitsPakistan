# ADR-0019: Derived unified search and coalesced change delivery

Date: 2026-10-04. Status: Accepted for Sprint 3.

Implement `destinations_v1`, `places_v1`, `experiences_v1` as stable aliases over generation-named OpenSearch indexes. Reserve future family descriptors without creating indexes. Canonical UUIDs identify documents. Public fields only, strict mappings, versioned analyzers and curated synonyms. PostgreSQL retains all authority.

Use a transactional PostgreSQL generation marker with statement triggers over public projection dependencies and a durable entity hash manifest. A session advisory lock serializes jobs; no external call occurs inside a canonical write transaction. Worker reads observed generation, builds a bounded public snapshot, delivers only changed documents/deletions and checkpoints on success. On crash/reordered retries it re-reads current data instead of replaying stale entity payloads. Changes during indexing remain pending. Periodic reconciliation detects drift and command-driven rebuild supports index loss.

Compared with a per-entity outbox fanout, global invalidation catches source retirement, hierarchy and relationship dependency changes without fragile propagation rules. At representative national discovery size, complete snapshot reads with hash-diffed incremental writes are practical. This is an explicit MVP tradeoff, not a claim of per-row streaming. No Redis queue or Kafka is required; the existing ContentOutbox remains owned by content and is not marked delivered by search. Revisit scanning/coalescing when measured latency or 20000-entity safety limits require it.

Rebuild populates three fresh indexes then atomically switches aliases; old indexes are retained for operator rollback. A failed bulk operation never marks a successful generation. Lock release handles process death through PostgreSQL session closure. A crash after alias switch but before manifest write is recoverable by reconciliation. Canonical withdrawals are hidden immediately by PostgreSQL eligibility filtering at query time, even during index outage/lag. Search hits are returned with current canonical fields.

Ranking uses exact/phrase name, alternative names, fuzzy text, destination/ancestor context and explicit family/category tags. Optional proximity is a bounded tie signal; no paid/commercial signal is accepted. Supplied Urdu names/romanizations use canonical alternate names and Unicode normalization; no machine-generated transliteration is asserted as canonical. Search pages are SSR/noindex with canonical detail links.
