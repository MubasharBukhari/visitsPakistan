import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../../apps/api/src/app';
import { createGraphClient } from '@visitspakistan/database';
import { databaseUrl, parseServerConfig } from '@visitspakistan/config';
import { stubProbe } from '@visitspakistan/testing';
import { discoveryFixture } from '../fixtures/discovery';
import {
  seedKnowledgeGraph,
  seedDestinationProfiles,
  seedId,
} from '../../libs/database/src/seed';
import {
  seedDiscovery,
  attractionSeeds,
  experienceSeeds,
} from '../../libs/database/src/discovery-seed';
const base = parseServerConfig(process.env),
  url = new URL(databaseUrl(base)),
  name = process.env.DB_TEST_NAME;
if (!name?.endsWith('_test') || name === url.pathname.slice(1))
  throw Error('Isolated test database required');
url.pathname = `/${name}`;
const db = createGraphClient(url.toString());
let app: INestApplication,
  root: string,
  f: Awaited<ReturnType<typeof discoveryFixture>>;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'vp-discovery-'));
  f = await discoveryFixture(db, root);
  app = await createApplication(
    { ...base, DATABASE_URL: url.toString(), DB_NAME: name!, MEDIA_ROOT: root },
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
const get = (path: string) =>
  request(app.getHttpServer()).get(`/api/v1/${path}`);
const places = () => get(`places/${f.placeSlug}`);
const things = (q = {}) =>
  get('things-to-do').query({ destination: f.hunzaSlug, ...q });
test('canonical Place facts and PostGIS coordinates compose published attraction editorial', async () => {
  const r = await places().expect(200);
  expect(r.body.canonical).toMatchObject({
    id: f.attraction,
    place_type: 'ATTRACTION',
    alt_names: ['Synthetic lake'],
    duration_minutes: 90,
    family_suitable: true,
    coordinates: { latitude: 36.337, longitude: 74.867 },
  });
  expect(r.body.editorial.type).toBe('ATTRACTION_EDITORIAL');
  expect(r.body.editorial.author).not.toHaveProperty('passwordHash');
  expect(r.body.canonical).not.toHaveProperty('facts');
  expect(r.body.destinations.map((d: { id: string }) => d.id)).toEqual([
    f.hunza,
  ]);
  expect(r.body.experiences.map((d: { id: string }) => d.id).sort()).toEqual(
    [f.experience, f.photo].sort(),
  );
  const dest = await get(`destinations/${f.hunzaSlug}`).expect(200);
  expect(dest.body.attractions.map((d: { id: string }) => d.id).sort()).toEqual(
    [f.attraction, f.neighbour].sort(),
  );
});
test('independent Experience maps editorial and reverse canonical connections without offers', async () => {
  const r = await get(`experiences/${f.experienceSlug}`).expect(200);
  expect(r.body.editorial.type).toBe('EXPERIENCE_EDITORIAL');
  expect(r.body.canonical).toMatchObject({
    kind: 'EXPERIENCE',
    category: 'boating',
    duration_minutes: 45,
    family_suitable: false,
    coordinates: null,
  });
  expect(r.body.places.map((d: { id: string }) => d.id)).toEqual([
    f.attraction,
  ]);
  expect(r.body.destinations.map((d: { id: string }) => d.id)).toEqual([
    f.hunza,
  ]);
  expect(r.body).not.toHaveProperty('offers');
  expect(r.body.canonical).not.toHaveProperty('price');
});
test('normalized NEAR is symmetric, sourced and measures straight-line point distance', async () => {
  const a = (await places().expect(200)).body.nearby[0];
  const b = (await get(`places/${f.neighbourSlug}`).expect(200)).body.nearby[0];
  expect(a.id).toBe(f.neighbour);
  expect(b.id).toBe(f.attraction);
  expect(a.distance_meters).toBeGreaterThan(150);
  expect(a.distance_meters).toBeLessThan(200);
  expect(b.distance_meters).toBeCloseTo(a.distance_meters, 5);
  expect(
    (await places().expect(200)).body.sources.map((s: { id: string }) => s.id),
  ).toContain(f.edgeSource.id);
  await db.sourceRecord.update({
    where: { id: f.edgeSource.id },
    data: { retiredAt: new Date() },
  });
  try {
    expect((await places().expect(200)).body.nearby).toEqual([]);
  } finally {
    await db.sourceRecord.update({
      where: { id: f.edgeSource.id },
      data: { retiredAt: null },
    });
  }
});
test('AND filters support destination paths, normalized category, season, family and maximum duration', async () => {
  expect((await things().expect(200)).body.pagination.total).toBe(4);
  const r = await things({
    category: 'PHOTOGRAPHY',
    season: 'winter',
    familySuitable: 'true',
    duration: 150,
  }).expect(200);
  expect(
    r.body.data.map((d: { canonical: { id: string } }) => d.canonical.id),
  ).toEqual([f.photo]);
  expect(
    (await things({ category: 'photography', duration: 60 }).expect(200)).body
      .data,
  ).toEqual([]);
  expect(
    (await things({ familySuitable: 'false' }).expect(200)).body.data.map(
      (d: { canonical: { id: string } }) => d.canonical.id,
    ),
  ).toEqual([f.experience]);
  expect(
    (await things({ kind: 'place' }).expect(200)).body.pagination.total,
  ).toBe(2);
  expect((await things({ category: 'camping' }).expect(200)).body.data).toEqual(
    [],
  );
  const unknown = await get(`experiences/${f.unknownSlug}`).expect(200);
  expect(unknown.body.canonical.family_suitable).toBeNull();
  expect(unknown.body.canonical.duration_minutes).toBeNull();
});
test('bounded stable pagination and filtered empty states preserve totals and facets', async () => {
  const a = await things({ pageSize: 1 }).expect(200),
    b = await things({ pageSize: 1, page: 2 }).expect(200);
  expect(a.body.pagination).toEqual({
    page: 1,
    pageSize: 1,
    total: 4,
    totalPages: 4,
  });
  expect(a.body.data[0].canonical.id).not.toBe(b.body.data[0].canonical.id);
  expect((await things({ page: 10000 }).expect(200)).body.data).toEqual([]);
  expect(a.body.facets.destinations).toContainEqual({
    name: 'Hunza',
    slug: f.hunzaSlug,
  });
  expect(a.body.facets.categories).toContain('photography');
});
test.each([
  { page: 0 },
  { pageSize: 49 },
  { duration: 0 },
  { duration: '1.5' },
  { duration: 10081 },
  { familySuitable: 'yes' },
  { season: 'monsoon' },
  { category: "x' OR 1=1" },
  { kind: 'product' },
  { sort: 'secret' },
])('rejects malformed query %j', async (q) => {
  await things(q).expect(422);
});
test('owner/source/edge publication gates prevent inaccessible graph links and missing entities return 404', async () => {
  await db.entityRegistry.update({
    where: { id: f.hunza },
    data: { status: 'DRAFT' },
  });
  try {
    await places().expect(404);
    await get(`experiences/${f.experienceSlug}`).expect(404);
    expect((await things().expect(200)).body.data).toEqual([]);
    await get(`experiences/${f.unknownSlug}`).expect(200);
  } finally {
    await db.entityRegistry.update({
      where: { id: f.hunza },
      data: { status: 'PUBLISHED' },
    });
  }
  await db.entityRelation.updateMany({
    where: { sourceId: f.attraction, type: 'HAS_EXPERIENCE' },
    data: { status: 'DRAFT' },
  });
  try {
    expect((await places().expect(200)).body.experiences).toEqual([]);
    expect(
      (await get(`experiences/${f.experienceSlug}`).expect(200)).body.places,
    ).toEqual([]);
  } finally {
    await db.entityRelation.updateMany({
      where: { sourceId: f.attraction, type: 'HAS_EXPERIENCE' },
      data: { status: 'PUBLISHED' },
    });
  }
  await get('places/unknown-discovery-slug').expect(404);
  await get('experiences/unknown-discovery-slug').expect(404);
  await get(`places/place-${f.restaurant}`).expect(404);
});
test('experience editorial cannot reference a Place and published snapshots survive new drafts', async () => {
  await expect(
    f.store.create(f.author, {
      type: 'EXPERIENCE_EDITORIAL',
      slug: 'invalid-' + f.photo,
      locale: 'en',
      primaryEntityId: f.attraction,
      body: {
        title: 'Invalid mapping',
        summary: '',
        seoTitle: 'Mapping',
        metaDescription: '',
        blocks: [],
        sourceIds: [f.source.id],
        canonicalIds: [f.attraction],
        heroMediaId: null,
        lastVerified: null,
      },
    }),
  ).rejects.toThrow('canonical experience');
  const doc = await f.store.getAdmin(f.editor, f.docs[1]!);
  await f.store.action(f.editor, doc.id, {
    action: 'new-draft',
    expectedVersion: doc.version,
  });
  expect(
    (await get(`experiences/${f.experienceSlug}`).expect(200)).body.editorial
      .title,
  ).toBe('Boating concept editorial (test)');
});
test('rich fact database constraints reject invalid duration and season tags', async () => {
  await expect(
    db.place.update({
      where: { id: f.attraction },
      data: { durationMinutes: 0 },
    }),
  ).rejects.toThrow();
  await expect(
    db.place.update({
      where: { id: f.attraction },
      data: { seasons: ['invented-season'] },
    }),
  ).rejects.toThrow();
});
test('all representative attraction and independent experience development seeds are idempotent drafts', async () => {
  await seedKnowledgeGraph(db);
  await seedDestinationProfiles(db);
  await seedDiscovery(db);
  await seedDiscovery(db);
  const ids = [
    seedId(20),
    ...attractionSeeds.map((p) => p.id),
    seedId(21),
    ...experienceSeeds.map((e) => e.id),
  ];
  const rows = await db.entityRegistry.findMany({
    where: { id: { in: ids } },
    include: { place: true, experience: true },
  });
  expect(rows).toHaveLength(15);
  expect(
    rows.every((r) => r.status === 'DRAFT' && r.lastVerified === null),
  ).toBe(true);
  expect(
    rows
      .filter((r) => r.place)
      .map((r) => r.name)
      .sort(),
  ).toEqual(
    [
      'Attabad Lake',
      'Baltit Fort',
      'Passu Cones',
      'Deosai',
      'Badshahi Mosque',
      'Lahore Fort',
      'Faisal Mosque',
      'Margalla Hills',
    ].sort(),
  );
  expect(
    rows
      .filter((r) => r.place)
      .every(
        (r) =>
          r.place!.openingInformation === null &&
          r.place!.admissionInformation === null &&
          r.place!.familySuitable === null,
      ),
  ).toBe(true);
});
