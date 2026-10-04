import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { SearchProjectionReader } from '@visitspakistan/database';
import type { PrismaClient } from '@visitspakistan/database';
import type { SearchType, SearchDocument } from '@visitspakistan/domain';
import { OpenSearchClient } from './client';
const digest = (d: SearchDocument) =>
  createHash('sha256').update(JSON.stringify(d)).digest('hex');
export class SearchIndexer {
  constructor(
    private readonly db: PrismaClient,
    private readonly databaseUrl: string,
    private readonly search: OpenSearchClient,
  ) {}
  async sync(options: { rebuild?: boolean; reconcile?: boolean } = {}) {
    const lock = new Client({
      connectionString: this.databaseUrl,
      connectionTimeoutMillis: 5000,
    });
    await lock.connect();
    try {
      const lease = await lock.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(742819033) AS locked',
      );
      if (!lease.rows[0]!.locked) return { status: 'busy' };
      const global = await this.db.searchState.findUniqueOrThrow({
        where: { id: 'public_v1' },
      });
      const key = `public_v1:${this.search.prefix}`;
      const state = await this.db.searchState.upsert({
        where: { id: key },
        create: { id: key },
        update: {},
      });
      const current = await this.search.aliases();
      const rebuild =
        options.rebuild ||
        !current ||
        Object.values(current).filter(Boolean).length !== 3;
      if (
        !rebuild &&
        !options.reconcile &&
        global.generation === state.indexedGeneration
      )
        return { status: 'current', generation: global.generation.toString() };
      const documents = await new SearchProjectionReader(this.db).snapshot();
      const prior = await this.db.searchManifest.findMany({
        where: { namespace: this.search.prefix },
      });
      const hashes = new Map(prior.map((p) => [p.id, p.hash]));
      const active = new Set(documents.map((d) => d.id));
      const changed = documents.filter(
        (d) => rebuild || hashes.get(d.id) !== digest(d),
      );
      const removed = prior
        .filter((p) => !active.has(p.id))
        .map((p) => ({ id: p.id, type: p.type as SearchType }));
      const indexes = rebuild
        ? await this.search.createGeneration(randomUUID().replaceAll('-', ''))
        : undefined;
      // Bounded bulk batches, checked item by item. Any failure leaves checkpoint dirty.
      for (let offset = 0; offset < changed.length; offset += 200)
        await this.search.bulk(
          changed.slice(offset, offset + 200),
          [],
          indexes,
        );
      if (!rebuild)
        for (let offset = 0; offset < removed.length; offset += 200)
          await this.search.bulk([], removed.slice(offset, offset + 200));
      if (indexes) await this.search.switchAliases(indexes);
      await this.db.$transaction(
        async (tx) => {
          await tx.searchManifest.deleteMany({
            where: { namespace: this.search.prefix },
          });
          if (documents.length)
            await tx.searchManifest.createMany({
              data: documents.map((d) => ({
                id: d.id,
                type: d.type,
                hash: digest(d),
                namespace: this.search.prefix,
              })),
            });
          await tx.searchState.update({
            where: { id: key },
            data: {
              indexedGeneration: global.generation,
              indexedAt: new Date(),
            },
          });
        },
        { timeout: 15000 },
      );
      return {
        status: rebuild ? 'rebuilt' : 'indexed',
        upserts: changed.length,
        deletions: removed.length,
        generation: global.generation.toString(),
      };
    } finally {
      // PostgreSQL releases session locks on close, including after process death.
      await lock.end();
    }
  }
}
