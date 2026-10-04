import 'dotenv/config';
import { setTimeout as pause } from 'node:timers/promises';
import { parseServerConfig, databaseUrl } from '../libs/config/src';
import { createGraphClient } from '../libs/database/src';
import { OpenSearchClient, SearchIndexer } from '../libs/search/src';
async function run() {
  const config = parseServerConfig(process.env),
    url = databaseUrl(config);
  const db = createGraphClient(url),
    indexer = new SearchIndexer(
      db,
      url,
      new OpenSearchClient(
        config.OPENSEARCH_INDEX_URL ?? config.OPENSEARCH_URL,
        config.SEARCH_INDEX_PREFIX,
      ),
    );
  const mode = process.argv[2] ?? 'sync';
  if (!['sync', 'rebuild', 'reconcile', 'worker', 'status'].includes(mode))
    throw new Error('Unknown search job');
  let stop = false;
  const shutdown = new AbortController();
  for (const s of ['SIGINT', 'SIGTERM'] as const)
    process.once(s, () => {
      stop = true;
      shutdown.abort();
    });
  try {
    if (mode === 'status') {
      const global = await db.searchState.findUniqueOrThrow({
          where: { id: 'public_v1' },
        }),
        state = await db.searchState.findUnique({
          where: { id: `public_v1:${config.SEARCH_INDEX_PREFIX}` },
        });
      console.log(
        JSON.stringify({
          job: 'search',
          generation: global.generation.toString(),
          indexedGeneration: state?.indexedGeneration.toString() ?? '0',
          indexedAt: state?.indexedAt ?? null,
          pending: !state || state.indexedGeneration !== global.generation,
        }),
      );
      return;
    }
    let lastReconcile = 0;
    let retryDelay = 2000;
    do {
      try {
        const reconcile =
          mode === 'reconcile' ||
          (mode === 'worker' && Date.now() - lastReconcile > 60000);
        const result = await indexer.sync({
          rebuild: mode === 'rebuild',
          reconcile,
        });
        if (mode !== 'worker' || result.status !== 'current')
          console.log(
            JSON.stringify({
              job: 'search',
              ...result,
            }),
          );
        retryDelay = 2000;
        if (reconcile) lastReconcile = Date.now();
      } catch {
        retryDelay = Math.min(retryDelay * 2, 30000);
        console.error(
          JSON.stringify({
            job: 'search',
            status: 'failed',
            message: 'Delivery failed; checkpoint retained for retry',
          }),
        );
        if (mode !== 'worker') {
          process.exitCode = 1;
          break;
        }
      }
      if (mode !== 'worker' || stop) break;
      await pause(retryDelay, undefined, { signal: shutdown.signal }).catch(
        () => {},
      );
    } while (!stop);
  } finally {
    await db.$disconnect();
  }
}
run().catch(() => {
  console.error(
    'Search job failed; verify database, index namespace and OpenSearch availability',
  );
  process.exitCode = 1;
});
