import 'dotenv/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { databaseUrl, parseServerConfig } from '../libs/config/src';
import { createGraphClient, createDatabaseProbe } from '../libs/database/src';
import { createApplication } from '../apps/api/src/app';
import { destinationFixture } from '../tests/fixtures/destinations';
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
  const root = await mkdtemp(join(tmpdir(), 'vp-destination-preview-'));
  const f = await destinationFixture(db, root);
  const app = await createApplication(
    {
      ...base,
      DATABASE_URL: url.toString(),
      DB_NAME: testName,
      MEDIA_ROOT: root,
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
    await db.$disconnect();
    await rm(root, { recursive: true, force: true });
  }
  try {
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
        'Synthetic destination preview, isolated test database only. Stop to withdraw fixtures.',
      directory: `http://127.0.0.1:3000/destinations/?region=${f.regionSlug}`,
      hunza: `http://127.0.0.1:3000/destinations/${f.hunzaSlug}/`,
      skardu: `http://127.0.0.1:3000/destinations/${f.skarduSlug}/`,
    }),
  );
}
preview().catch(() => {
  console.error(
    'Destination preview failed; check isolated database setup and API port availability.',
  );
  process.exitCode = 1;
});
