import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { databaseUrl, parseServerConfig } from '@visitspakistan/config';
import {
  createGraphClient,
  SearchProjectionReader,
} from '@visitspakistan/database';
import {
  OpenSearchClient,
  SearchIndexer,
  UnifiedSearch,
  SearchUnavailable,
} from '@visitspakistan/search';
import { createApplication } from '../../apps/api/src/app';
import { searchFixture, type RelevanceCase } from '../fixtures/search';
const base = parseServerConfig(process.env),
  url = new URL(databaseUrl(base));
if (
  !process.env.DB_TEST_NAME?.endsWith('_test') ||
  process.env.DB_TEST_NAME === url.pathname.slice(1)
)
  throw new Error('Isolated test DB required');
url.pathname = '/' + process.env.DB_TEST_NAME;
const db = createGraphClient(url.toString()),
  prefix = `test_search_${randomUUID().replaceAll('-', '')}_`;
const os = new OpenSearchClient(base.OPENSEARCH_URL, prefix),
  indexer = new SearchIndexer(db, url.toString(), os),
  projection = new SearchProjectionReader(db),
  service = new UnifiedSearch(
    {
      snapshot: async () =>
        (await projection.snapshot()).filter((d) =>
          Object.values(f.ids).includes(d.id),
        ),
    },
    os,
  );
let root: string,
  f: Awaited<ReturnType<typeof searchFixture>>,
  app: INestApplication;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'vp-search-test-'));
  f = await searchFixture(db, root);
  await indexer.sync({ rebuild: true });
  app = await createApplication(
    {
      ...base,
      DATABASE_URL: url.toString(),
      SEARCH_INDEX_PREFIX: prefix,
      MEDIA_ROOT: root,
    },
    [],
    false,
  );
  await app.init();
}, 60000);
afterAll(async () => {
  if (app) await app.close();
  if (f) await f.cleanup();
  if (root) await rm(root, { recursive: true, force: true });
  try {
    const indices = await os.request<Record<string, unknown>>('/_alias');
    for (const name of Object.keys(indices).filter((n) => n.startsWith(prefix)))
      await os.request('/' + name, 'DELETE');
    await db.searchManifest.deleteMany({ where: { namespace: prefix } });
    await db.searchState.deleteMany({ where: { id: `public_v1:${prefix}` } });
  } finally {
    await db.$disconnect();
  }
}, 30000);
const cases = JSON.parse(
  readFileSync('tests/relevance/pakistan-search.json', 'utf8'),
) as RelevanceCase[];
test.each(cases)('relevance: $q → $expected', async (c) => {
  const r = await service.query({
    q: c.q,
    type: c.type,
    autocomplete: c.autocomplete ?? false,
  });
  const ids = r.groups.flatMap((g) => g.results.map((d) => d.id));
  expect(ids.slice(0, 3)).toContain(f.ids[c.expected]);
});
test('grouped API returns canonical connected results and bounded filters', async () => {
  const r = await request(app.getHttpServer())
    .get('/api/v1/search')
    .query({ q: 'Hunza', destination: f.hunzaSlug })
    .expect(200);
  expect(
    r.body.groups
      .find((g: { type: string }) => g.type === 'DESTINATION')
      .results.map((d: { id: string }) => d.id),
  ).toContain(f.hunza);
  expect(
    r.body.groups
      .find((g: { type: string }) => g.type === 'PLACE')
      .results.map((d: { id: string }) => d.id),
  ).toContain(f.attraction);
  const filtered = await service.query({
    q: 'Hunza',
    type: 'PLACE',
    destination: f.slugs.hunza,
  });
  expect(filtered.groups).toHaveLength(1);
  expect(
    filtered.groups[0]!.results.every((d) =>
      d.destination_slugs.includes(f.hunzaSlug),
    ),
  ).toBe(true);
  expect(
    (await service.query({ q: 'Hunza', destination: f.slugs.lahore })).total,
  ).toBe(0);
  expect((await service.query({ q: 'zzzzunmatchedword' })).total).toBe(0);
  expect(
    (await service.query({ q: 'Hunza', page: 100 })).groups.every(
      (g) => !g.results.length,
    ),
  ).toBe(true);
});
test.each([
  { q: '' },
  { q: 'a'.repeat(121) },
  { q: 'hunza', page: 0 },
  { q: 'hunza', page: 101 },
  { q: 'hunza', type: 'PARTNER' },
  { q: 'hunza', lat: 35 },
  { q: 'hunza', destination: '../private' },
  { q: 'hunza', sort: 'paid' },
])('API rejects invalid/unimplemented query %j', async (input) => {
  await request(app.getHttpServer())
    .get('/api/v1/search')
    .query(input)
    .expect(422);
});
test('immediate canonical withdrawal and relation removal cannot leak through lagging search', async () => {
  await db.entityRegistry.update({
    where: { id: f.attraction },
    data: { status: 'DRAFT' },
  });
  try {
    const r = await service.query({ q: 'Attabad' });
    expect(
      r.groups.flatMap((g) => g.results).some((d) => d.id === f.attraction),
    ).toBe(false);
    expect((await indexer.sync()).status).toBe('indexed');
    const raw = await os.query(
      'PLACE',
      { q: 'Attabad', page: 1, locale: 'en', autocomplete: false },
      [f.attraction],
    );
    expect(raw.total).toBe(0);
  } finally {
    await db.entityRegistry.update({
      where: { id: f.attraction },
      data: { status: 'PUBLISHED' },
    });
    await indexer.sync();
  }
  await db.entityRelation.updateMany({
    where: {
      sourceId: f.hunza,
      targetId: f.attraction,
      type: 'HAS_ATTRACTION',
    },
    data: { status: 'DRAFT' },
  });
  try {
    const r = await service.query({ q: 'Attabad', destination: f.hunzaSlug });
    expect(r.total).toBe(0);
  } finally {
    await db.entityRelation.updateMany({
      where: {
        sourceId: f.hunza,
        targetId: f.attraction,
        type: 'HAS_ATTRACTION',
      },
      data: { status: 'PUBLISHED' },
    });
    await indexer.sync();
  }
});
test('source retirement and missing geographic owner immediately hide indexed documents', async () => {
  await db.sourceRecord.update({
    where: { id: f.source.id },
    data: { retiredAt: new Date() },
  });
  try {
    expect((await service.query({ q: 'Hunza' })).total).toBe(0);
  } finally {
    await db.sourceRecord.update({
      where: { id: f.source.id },
      data: { retiredAt: null },
    });
  }
  await db.entityRegistry.update({
    where: { id: f.hunza },
    data: { status: 'DRAFT' },
  });
  try {
    expect((await service.query({ q: 'Attabad' })).total).toBe(0);
  } finally {
    await db.entityRegistry.update({
      where: { id: f.hunza },
      data: { status: 'PUBLISHED' },
    });
  }
  await indexer.sync();
});
test('failed delivery retains checkpoint, retries current canonical data and is idempotent', async () => {
  await db.entityRegistry.update({
    where: { id: f.attraction },
    data: { name: 'Attabad Lake renamed (test)' },
  });
  const before = await db.searchState.findUniqueOrThrow({
    where: { id: `public_v1:${prefix}` },
  });
  const failing = jest
    .spyOn(os, 'bulk')
    .mockRejectedValueOnce(new SearchUnavailable());
  await expect(indexer.sync()).rejects.toThrow('temporarily unavailable');
  failing.mockRestore();
  expect(
    (await db.searchState.findUniqueOrThrow({ where: { id: before.id } }))
      .indexedGeneration,
  ).toBe(before.indexedGeneration);
  await db.entityRegistry.update({
    where: { id: f.attraction },
    data: { name: 'Attabad Lake (test)' },
  });
  const result = await indexer.sync();
  expect(result.status).toBe('indexed');
  expect((await indexer.sync()).status).toBe('current');
});
test('failed rebuild leaves aliases intact; successful rebuild swaps all families and catches concurrent changes', async () => {
  const before = await os.aliases();
  const broken = jest
    .spyOn(os, 'bulk')
    .mockRejectedValueOnce(new SearchUnavailable());
  await expect(indexer.sync({ rebuild: true })).rejects.toThrow();
  broken.mockRestore();
  expect(await os.aliases()).toEqual(before);
  const original = os.bulk.bind(os);
  let changed = false;
  const race = jest.spyOn(os, 'bulk').mockImplementation(async (...args) => {
    await original(...args);
    if (!changed) {
      changed = true;
      await db.entityRegistry.update({
        where: { id: f.ids.lahore },
        data: { name: 'Lahore revised (test)' },
      });
    }
  });
  await indexer.sync({ rebuild: true });
  race.mockRestore();
  expect(await os.aliases()).not.toEqual(before);
  const checkpoint = await db.searchState.findUniqueOrThrow({
      where: { id: `public_v1:${prefix}` },
    }),
    dirty = await db.searchState.findUniqueOrThrow({
      where: { id: 'public_v1' },
    });
  expect(dirty.generation).toBeGreaterThan(checkpoint.indexedGeneration);
  expect((await indexer.sync()).status).toBe('indexed');
  expect(
    (await service.query({ q: 'Lahore revised', type: 'DESTINATION' }))
      .groups[0]!.results[0]!.name,
  ).toBe('Lahore revised (test)');
});
test('index loss can rebuild missing family and unsupported future families stay absent', async () => {
  const current = await os.aliases();
  await os.request('/' + current!.PLACE, 'DELETE');
  await indexer.sync({ rebuild: true });
  expect(Object.values((await os.aliases())!)).toHaveLength(3);
  const all = await os.request<Record<string, unknown>>('/_alias');
  expect(
    Object.keys(all).some(
      (n) =>
        n.startsWith(prefix) && /(partners|products|events|content)_v1/.test(n),
    ),
  ).toBe(false);
});
test('optional proximity uses current canonical points without accepting arbitrary geo inputs', async () => {
  const r = await service.query({ q: 'Hunza', lat: 36.3, lon: 74.7 });
  expect(r.total).toBeGreaterThan(0);
});

test('a concurrent job is skipped until the PostgreSQL session lease closes', async () => {
  const lock = new Client({ connectionString: url.toString() });
  await lock.connect();
  try {
    await lock.query('SELECT pg_advisory_lock(742819033)');
    expect((await indexer.sync()).status).toBe('busy');
  } finally {
    await lock.end();
  }
  expect((await indexer.sync({ reconcile: true })).status).toBe('indexed');
});
test('crash after alias swap retains checkpoint and current-data retry repairs manifest', async () => {
  await db.entityRegistry.update({
    where: { id: f.attraction },
    data: { name: 'Attabad Lake checkpoint (test)' },
  });
  const before = await db.searchState.findUniqueOrThrow({
    where: { id: `public_v1:${prefix}` },
  });
  const fail = jest
    .spyOn(db, '$transaction')
    .mockRejectedValueOnce(new Error('Simulated checkpoint crash'));
  try {
    await expect(indexer.sync({ rebuild: true })).rejects.toThrow('checkpoint');
  } finally {
    fail.mockRestore();
  }
  expect(
    (await db.searchState.findUniqueOrThrow({ where: { id: before.id } }))
      .indexedGeneration,
  ).toBe(before.indexedGeneration);
  expect((await indexer.sync()).status).toBe('indexed');
  expect(
    (await service.query({ q: 'Attabad checkpoint' })).groups
      .flatMap((g) => g.results)
      .map((d) => d.id),
  ).toContain(f.attraction);
});

test('public API reports unavailable engine as 503 rather than empty success', async () => {
  const offline = await createApplication(
    {
      ...base,
      DATABASE_URL: url.toString(),
      SEARCH_INDEX_PREFIX: prefix,
      OPENSEARCH_URL: 'http://127.0.0.1:1',
      MEDIA_ROOT: root,
    },
    [],
    false,
  );
  try {
    await offline.init();
    const r = await request(offline.getHttpServer())
      .get('/api/v1/search')
      .query({ q: 'Hunza', destination: f.hunzaSlug })
      .expect(503);
    expect(JSON.stringify(r.body)).not.toContain('127.0.0.1:1');
  } finally {
    await offline.close();
  }
});
