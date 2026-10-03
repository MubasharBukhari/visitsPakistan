import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../../apps/api/src/app';
import { createGraphClient, graphTransaction } from '@visitspakistan/database';
import { KnowledgeGraphService } from '@visitspakistan/domain';
import { databaseUrl, parseServerConfig } from '@visitspakistan/config';
import { stubProbe } from '@visitspakistan/testing';
import { destinationFixture } from '../fixtures/destinations';
const base = parseServerConfig(process.env);
const url = new URL(databaseUrl(base));
const testName = process.env.DB_TEST_NAME;
if (!testName?.endsWith('_test') || testName === url.pathname.slice(1))
  throw new Error('Isolated test database required');
url.pathname = `/${testName}`;
const db = createGraphClient(url.toString());
let app: INestApplication;
let root: string;
let f: Awaited<ReturnType<typeof destinationFixture>>;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'vp-destination-'));
  f = await destinationFixture(db, root);
  app = await createApplication(
    {
      ...base,
      DATABASE_URL: url.toString(),
      DB_NAME: testName!,
      MEDIA_ROOT: root,
    },
    [stubProbe('database', true)],
    false,
  );
  await app.init();
}, 30000);
afterAll(async () => {
  if (f) await f.cleanup();
  if (app) await app.close();
  await db.$disconnect();
  if (root) await rm(root, { recursive: true, force: true });
});
const directory = (query = {}) =>
  request(app.getHttpServer())
    .get('/v1/destinations')
    .query({ region: f.regionSlug, ...query });
const detail = () =>
  request(app.getHttpServer()).get(`/v1/destinations/${f.hunzaSlug}`);
test('Hunza and city-backed Skardu compose canonical profiles and published editorial', async () => {
  const r = await directory().expect(200);
  expect(
    r.body.data.map((d: { canonical: { name: string } }) => d.canonical.name),
  ).toEqual(['Hunza', 'Skardu']);
  expect(r.body.pagination.total).toBe(2);
  const h = await detail().expect(200);
  expect(h.body.canonical).toMatchObject({
    id: f.hunza,
    name: 'Hunza',
    coordinates: { latitude: 36.3167, longitude: 74.65 },
  });
  expect(h.body.editorial.title).toBe('Hunza, a different pace');
  expect(h.body.region.slug).toBe(f.provinceSlug);
  expect(h.body.hierarchy.map((h: { name: string }) => h.name)).toEqual([
    'Pakistan',
    'Northern Pakistan',
    'Gilgit-Baltistan',
  ]);
  expect(h.body.last_verified).toBe(f.time.toISOString());
  expect(h.body.sources[0]).toHaveProperty('publisher');
  expect(h.body.canonical).not.toHaveProperty('provenance');
  expect(h.body.editorial.author).not.toHaveProperty('passwordHash');
});
test('ancestor province filters, exact interests and all-year season matching', async () => {
  expect(
    (
      await directory({
        region: f.provinceSlug,
        interest: 'photography',
        season: 'summer',
      }).expect(200)
    ).body.data.map((d: { canonical: { name: string } }) => d.canonical.name),
  ).toEqual(['Hunza']);
  expect(
    (await directory({ season: 'winter' }).expect(200)).body.data.map(
      (d: { canonical: { name: string } }) => d.canonical.name,
    ),
  ).toEqual(['Skardu']);
  expect(
    (await directory({ interest: 'photo' }).expect(200)).body.pagination.total,
  ).toBe(0);
});
test('bounded stable pagination returns counts and preserves IDs', async () => {
  const a = await directory({ page: 1, pageSize: 1 }).expect(200);
  const b = await directory({ page: 2, pageSize: 1 }).expect(200);
  expect(a.body.pagination).toEqual({
    page: 1,
    pageSize: 1,
    total: 2,
    totalPages: 2,
  });
  expect(a.body.data[0].canonical.id).toBe(f.hunza);
  expect(b.body.data[0].canonical.id).toBe(f.skardu);
  expect(
    (await directory({ page: 3, pageSize: 1 }).expect(200)).body.data,
  ).toEqual([]);
});
test.each([
  { page: 0 },
  { page: '1.5' },
  { pageSize: 49 },
  { season: 'monsoon' },
  { region: ['region', 'another'] },
  { interest: "nature' OR 1=1" },
  { sort: 'secret' },
])('rejects invalid query %j', async (query) => {
  await directory(query).expect(422);
});
test('only published attractions/experiences join; guides are not fabricated routes/products', async () => {
  const r = await detail().expect(200);
  expect(r.body.attractions.map((e: { id: string }) => e.id)).toEqual([
    f.attraction,
  ]);
  expect(r.body.experiences.map((e: { id: string }) => e.id)).toEqual([
    f.experience,
  ]);
  expect(r.body.food.map((e: { id: string }) => e.id)).toEqual([f.restaurant]);
  expect(r.body.guides.map((g: { type: string }) => g.type).sort()).toEqual([
    'FOOD_GUIDE',
    'ITINERARY_EDITORIAL',
    'ROUTE_GUIDE',
  ]);
  expect(r.body.routes).toEqual([]);
  expect(r.body.itineraries).toEqual([]);
  expect(r.body.travel_products).toEqual([]);
});
test('draft revision preserves destination published story', async () => {
  const draft = await f.store.action(f.editor, f.hunzaEditorial.id, {
    action: 'new-draft',
    expectedVersion: f.hunzaEditorial.version,
  });
  expect(draft.currentRevision?.status).toBe('DRAFT');
  expect((await detail().expect(200)).body.editorial.title).toBe(
    'Hunza, a different pace',
  );
});
test('unpublished edges and retired provenance remove related facts', async () => {
  await db.entityRelation.updateMany({
    where: { sourceId: f.attraction, type: 'HAS_EXPERIENCE' },
    data: { status: 'DRAFT' },
  });
  expect((await detail().expect(200)).body.experiences).toEqual([]);
  await db.entityRelation.updateMany({
    where: { sourceId: f.attraction, type: 'HAS_EXPERIENCE' },
    data: { status: 'PUBLISHED' },
  });
  await db.sourceRecord.update({
    where: { id: f.source.id },
    data: { retiredAt: new Date() },
  });
  await detail().expect(404);
  expect((await directory().expect(200)).body.pagination.total).toBe(0);
  await db.sourceRecord.update({
    where: { id: f.source.id },
    data: { retiredAt: null },
  });
});
test('draft/deleted profiles and fixture sources are excluded; unknown slug is 404', async () => {
  await db.destinationProfile.update({
    where: { id: f.hunza },
    data: { status: 'DRAFT' },
  });
  await detail().expect(404);
  await db.destinationProfile.update({
    where: { id: f.hunza },
    data: { status: 'WITHDRAWN', deletedAt: new Date() },
  });
  await detail().expect(404);
  await db.destinationProfile.update({
    where: { id: f.hunza },
    data: { status: 'PUBLISHED', deletedAt: null },
  });
  await db.sourceRecord.update({
    where: { id: f.source.id },
    data: { sourceType: 'DEVELOPMENT_FIXTURE' },
  });
  await detail().expect(404);
  await db.sourceRecord.update({
    where: { id: f.source.id },
    data: { sourceType: 'EDITORIAL' },
  });
  await request(app.getHttpServer())
    .get('/v1/destinations/not-a-real-destination')
    .expect(404);
});
test('database rejects discovery profiles on region geography and invalid seasons', async () => {
  await expect(
    db.destinationProfile.create({
      data: { id: f.region, sourceId: f.source.id },
    }),
  ).rejects.toThrow();
  await expect(
    db.destinationProfile.update({
      where: { id: f.hunza },
      data: { seasons: ['invented-season'] },
    }),
  ).rejects.toThrow();
});

test('standard API path exposes PostGIS point, canonical lifecycle, parent and sibling destinations', async () => {
  const r = await request(app.getHttpServer())
    .get(`/api/v1/destinations/${f.hunzaSlug}`)
    .expect(200);
  expect(r.body.canonical).toMatchObject({
    parent_id: f.province,
    status: 'PUBLISHED',
    latitude: 36.3167,
    longitude: 74.65,
    geometry: { type: 'Point', coordinates: [74.65, 36.3167] },
  });
  expect(new Date(r.body.canonical.created_at).getTime()).toBeGreaterThan(0);
  expect(r.body.geographic_parent).toMatchObject({
    id: f.province,
    type: 'PROVINCE_TERRITORY',
    name: 'Gilgit-Baltistan',
    destination_slug: null,
  });
  expect(
    r.body.related_destinations.map(
      (d: { canonical: { id: string } }) => d.canonical.id,
    ),
  ).toEqual([f.skardu]);
  expect(r.body.editorial.destination).toMatchObject({
    quickAnswer: 'A synthetic destination overview for isolated testing.',
    faq: [{ question: 'Where is this destination?' }],
  });
  const list = await request(app.getHttpServer())
    .get('/api/v1/destinations')
    .query({ region: f.regionSlug })
    .expect(200);
  expect(list.body.pagination.total).toBe(2);
  await request(app.getHttpServer())
    .get('/api/v1/destinations/unknown-sprint-one-destination')
    .expect(404);
});

test('direct geographic children are publication gated and summary is canonical', async () => {
  const child = randomUUID();
  try {
    await graphTransaction(db, async (repo, tx) => {
      await new KnowledgeGraphService(repo).createGeo({
        id: child,
        type: 'NEIGHBOURHOOD',
        name: 'Synthetic neighbourhood',
        slug: `neighbourhood-${child}`,
        parentId: f.hunza,
        summary: 'Canonical geographic summary',
        primarySourceId: f.source.id,
      });
      await tx.entityRegistry.update({
        where: { id: child },
        data: { status: 'PUBLISHED', lastVerified: f.time },
      });
    });
    const visible = (await detail().expect(200)).body.geographic_children;
    expect(visible).toEqual([
      expect.objectContaining({
        id: child,
        type: 'NEIGHBOURHOOD',
        summary: 'Canonical geographic summary',
        destination_slug: null,
      }),
    ]);
    await db.entityRegistry.update({
      where: { id: child },
      data: { status: 'DRAFT' },
    });
    expect((await detail().expect(200)).body.geographic_children).toEqual([]);
    await db.entityRegistry.update({
      where: { id: f.province },
      data: { status: 'DRAFT' },
    });
    expect((await detail().expect(200)).body.geographic_parent).toBeNull();
  } finally {
    await db.entityRegistry.update({
      where: { id: f.province },
      data: { status: 'PUBLISHED' },
    });
    await db.entityRegistry.updateMany({
      where: { id: child },
      data: { status: 'WITHDRAWN', deletedAt: new Date() },
    });
  }
});

test('destination presentation survives new draft creation and published JSON is immutable', async () => {
  const doc = await db.editorialDocument.findUniqueOrThrow({
    where: { id: f.hunzaEditorial.id },
    include: { currentRevision: true, publishedRevision: true },
  });
  expect(doc.currentRevision!.destination).toEqual(
    doc.publishedRevision!.destination,
  );
  await expect(
    db.editorialRevision.update({
      where: { id: doc.publishedRevisionId! },
      data: { destination: { overview: 'Changed behind review' } },
    }),
  ).rejects.toThrow();
  await db.editorialRevision.update({
    where: { id: doc.currentRevisionId! },
    data: {
      destination: {
        ...(doc.currentRevision!.destination as object),
        quickAnswer: 'Unpublished changed answer',
      },
    },
  });
  expect(
    (await detail().expect(200)).body.editorial.destination.quickAnswer,
  ).toBe('A synthetic destination overview for isolated testing.');
});

test('submitted destination presentation cannot bypass review using a direct database update', async () => {
  const doc = await db.editorialDocument.findUniqueOrThrow({
    where: { id: f.hunzaEditorial.id },
  });
  const submitted = await f.store.action(f.editor, doc.id, {
    action: 'submit',
    expectedVersion: doc.version,
  });
  await expect(
    db.editorialRevision.update({
      where: { id: submitted.currentRevisionId! },
      data: { destination: { quickAnswer: 'Unreviewed replacement' } },
    }),
  ).rejects.toThrow('Submitted destination presentation is immutable');
});
