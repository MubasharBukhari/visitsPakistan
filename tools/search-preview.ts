import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { OpenSearchClient, SearchIndexer } from '../libs/search/src';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { databaseUrl, parseServerConfig } from '../libs/config/src';
import { createGraphClient, createDatabaseProbe } from '../libs/database/src';
import { createApplication } from '../apps/api/src/app';
import { searchFixture } from '../tests/fixtures/search';
async function preview() {
  const base = parseServerConfig(process.env);
  const url = new URL(databaseUrl(base));
  const testName = process.env.DB_TEST_NAME;
  if (
    base.NODE_ENV === 'production' ||
    !testName?.endsWith('_test') ||
    testName === url.pathname.slice(1)
  )
    throw new Error('Local isolated test database required');
  url.pathname = `/${testName}`;
  const db = createGraphClient(url.toString());
  const root = await mkdtemp(join(tmpdir(), 'vp-search-preview-'));
  const f = await searchFixture(db, root);
  const prefix = `preview_search_${randomUUID().slice(0, 8).replaceAll('-', '')}_`;
  const os = new OpenSearchClient(
    base.OPENSEARCH_INDEX_URL ?? base.OPENSEARCH_URL,
    prefix,
  );
  const indexer = new SearchIndexer(db, url.toString(), os);
  const app = await createApplication(
    {
      ...base,
      DATABASE_URL: url.toString(),
      DB_NAME: testName,
      MEDIA_ROOT: root,
      SEARCH_INDEX_PREFIX: prefix,
    },
    [createDatabaseProbe(url.toString(), base.DEPENDENCY_TIMEOUT_MS)],
    false,
    false, // The preview must finish fixture cleanup before process termination.
  );
  let closing = false;
  async function cleanup() {
    if (closing) return;
    closing = true;
    await app.close();
    await f.cleanup();
    const indices = await os.request<Record<string, unknown>>('/_alias');
    for (const name of Object.keys(indices).filter((n) => n.startsWith(prefix)))
      await os.request('/' + name, 'DELETE');
    await db.searchManifest.deleteMany({ where: { namespace: prefix } });
    await db.searchState.deleteMany({ where: { id: `public_v1:${prefix}` } });
    await db.$disconnect();
    await rm(root, { recursive: true, force: true });
  }
  try {
    await indexer.sync({ rebuild: true });
    await app.listen(base.API_PORT, '127.0.0.1');
  } catch (e) {
    await cleanup();
    throw e;
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(
      signal,
      () =>
        void cleanup().catch(() => {
          process.exitCode = 1;
        }),
    );
  console.log(
    JSON.stringify({
      message:
        'Synthetic search preview, isolated test database only. Stop to withdraw fixtures.',
      namespace: prefix,
      search: `http://127.0.0.1:3000/search/?q=Hunza&destination=${f.hunzaSlug}`,
      directory: `http://127.0.0.1:3000/destinations/?region=${f.regionSlug}`,
      hunza: `http://127.0.0.1:3000/destinations/${f.hunzaSlug}/`,
      place: `http://127.0.0.1:3000/places/${f.placeSlug}/`,
      experience: `http://127.0.0.1:3000/experiences/${f.experienceSlug}/`,
      things: `http://127.0.0.1:3000/things-to-do/?destination=${f.hunzaSlug}`,
    }),
  );
}
preview().catch(() => {
  console.error(
    'Search preview failed; check isolated database setup and API port availability.',
  );
  process.exitCode = 1;
});
