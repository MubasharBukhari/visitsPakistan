import { randomUUID } from 'node:crypto';
import {
  createGraphClient,
  graphTransaction,
  PrismaKnowledgeGraphRepository,
} from '@visitspakistan/database';
import { KnowledgeGraphService, geoTypes } from '@visitspakistan/domain';
import { databaseUrl, parseServerConfig } from '@visitspakistan/config';
import {
  seedKnowledgeGraph,
  seedId,
  seedGeography,
  seedDestinationProfiles,
} from '../../libs/database/src/seed';
import type { Prisma } from '../../libs/database/src/generated/client';
const config = parseServerConfig(process.env);
const name = process.env.DB_TEST_NAME;
const url = new URL(databaseUrl(config));
if (!name || !name.endsWith('_test') || name === url.pathname.slice(1))
  throw new Error('An isolated test database is required');
url.pathname = `/${name}`;
const client = createGraphClient(url.toString());
afterAll(() => client.$disconnect());
class Rollback extends Error {}
async function rollback(
  work: (
    repo: PrismaKnowledgeGraphRepository,
    tx: Prisma.TransactionClient,
  ) => Promise<void>,
) {
  try {
    await graphTransaction(client, async (repo, tx) => {
      await work(repo, tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}
async function fixture(
  repo: PrismaKnowledgeGraphRepository,
  tx: Prisma.TransactionClient,
) {
  const source = await tx.sourceRecord.create({
    data: {
      sourceKey: randomUUID(),
      title: 'Isolated test source',
      publisher: 'Integration test',
      accessedAt: new Date(),
      sourceType: 'EDITORIAL',
    },
  });
  const service = new KnowledgeGraphService(repo);
  const country = randomUUID();
  const destination = randomUUID();
  const place = randomUUID();
  const experience = randomUUID();
  const content = randomUUID();
  await service.createGeo({
    id: country,
    name: 'Test country',
    slug: `test-${country}`,
    type: 'COUNTRY',
    primarySourceId: source.id,
  });
  await service.createGeo({
    id: destination,
    name: 'Test destination',
    slug: `test-${destination}`,
    type: 'DESTINATION',
    parentId: country,
    coordinates: { longitude: 74, latitude: 36 },
    primarySourceId: source.id,
  });
  await service.createPlace({
    id: place,
    name: 'Test attraction',
    slug: `test-${place}`,
    type: 'ATTRACTION',
    geoEntityId: destination,
    coordinates: { longitude: 74.001, latitude: 36 },
    primarySourceId: source.id,
  });
  await service.createExperience({
    id: experience,
    name: 'Test experience',
    slug: `test-${experience}`,
    category: 'WALKING',
    geoEntityId: destination,
    durationMinutes: 30,
    seasons: ['SPRING'],
    primarySourceId: source.id,
  });
  await service.createContent({
    id: content,
    name: 'Test guide',
    slug: `test-${content}`,
    type: 'GUIDE',
    primaryEntityId: destination,
    primarySourceId: source.id,
  });
  return { source, service, country, destination, place, experience, content };
}
async function verifiedTime(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<
    Array<{ time: Date }>
  >`SELECT clock_timestamp() - interval '1 second' AS time`;
  return rows[0]!.time;
}
async function publish(tx: Prisma.TransactionClient, ids: string[]) {
  await tx.entityRegistry.updateMany({
    where: { id: { in: ids } },
    data: { status: 'PUBLISHED', lastVerified: await verifiedTime(tx) },
  });
}
test('repository round-trips typed entities, WGS84 and all six hierarchy tiers', async () => {
  await rollback(async (repo, tx) => {
    const f = await fixture(repo, tx);
    const geo = await repo.findGeo(f.destination);
    expect(geo).toMatchObject({
      type: 'DESTINATION',
      parentId: f.country,
      status: 'DRAFT',
      lastVerified: null,
      coordinates: { longitude: 74, latitude: 36 },
    });
    expect(
      await tx.experience.findUnique({ where: { id: f.experience } }),
    ).toMatchObject({ category: 'WALKING', durationMinutes: 30 });
    expect(
      await tx.contentItem.findUnique({ where: { id: f.content } }),
    ).toMatchObject({ primaryEntityId: f.destination });
    let parent: string | undefined;
    for (const type of geoTypes) {
      const id = randomUUID();
      await f.service.createGeo({
        id,
        name: type,
        slug: `tier-${id}`,
        type,
        parentId: parent,
      });
      parent = id;
    }
    await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  });
});
test('public proximity uses meters and excludes draft, withdrawn, distant and deleted owners', async () => {
  await rollback(async (repo, tx) => {
    const f = await fixture(repo, tx);
    const query = {
      coordinates: { longitude: 74, latitude: 36 },
      radiusMeters: 1000,
    };
    expect(await f.service.nearbyPlaces(query)).toEqual([]);
    await publish(tx, [f.destination, f.place]);
    let nearby = await f.service.nearbyPlaces(query);
    expect(nearby.map((p) => p.id)).toContain(f.place);
    expect(
      nearby.find((p) => p.id === f.place)?.distanceMeters,
    ).toBeGreaterThan(80);
    expect(nearby.find((p) => p.id === f.place)?.distanceMeters).toBeLessThan(
      100,
    );
    expect(
      (await f.service.nearbyPlaces({ ...query, radiusMeters: 10 })).map(
        (p) => p.id,
      ),
    ).not.toContain(f.place);
    await tx.entityRegistry.update({
      where: { id: f.destination },
      data: { deletedAt: new Date(), status: 'WITHDRAWN' },
    });
    nearby = await f.service.nearbyPlaces(query);
    expect(nearby.map((p) => p.id)).not.toContain(f.place);
    expect(await repo.findGeo(f.destination)).toBeNull();
  });
});
test('published graph projection excludes withdrawn endpoints and retired provenance', async () => {
  await rollback(async (repo, tx) => {
    const f = await fixture(repo, tx);
    const edge = await f.service.createRelation({
      sourceId: f.content,
      sourceKind: 'CONTENT_ITEM',
      targetId: f.destination,
      targetKind: 'GEO_ENTITY',
      type: 'ABOUT',
      sourceRecordId: f.source.id,
    });
    expect(await repo.relationsFor(f.destination)).toEqual([]);
    await publish(tx, [f.content, f.destination]);
    await tx.entityRelation.update({
      where: { id: edge },
      data: { status: 'PUBLISHED', lastVerified: await verifiedTime(tx) },
    });
    expect((await repo.relationsFor(f.destination)).map((r) => r.id)).toContain(
      edge,
    );
    await tx.sourceRecord.update({
      where: { id: f.source.id },
      data: { retiredAt: new Date() },
    });
    expect(await repo.relationsFor(f.destination)).toEqual([]);
  });
});
test.each([
  'slug',
  'parent-tier',
  'type-fk',
  'dangling-fk',
  'invalid-relation',
  'duplicate-edge',
  'wrong-part-of',
  'unverified-publication',
  'fixture-publication',
  'owner-identity',
  'reparent-edge',
  'confidence',
  'missing-owner',
  'reserved-owner',
  'future-verification',
  'source-delete',
] as const)(
  'database rejects %s and rolls back the transaction',
  async (scenario) => {
    const marker = randomUUID();
    await expect(
      rollback(async (repo, tx) => {
        const f = await fixture(repo, tx);
        await tx.sourceRecord.create({
          data: {
            sourceKey: marker,
            title: 'Rollback marker',
            publisher: 'Test',
            accessedAt: new Date(),
            sourceType: 'EDITORIAL',
          },
        });
        switch (scenario) {
          case 'slug':
            await repo.createGeo({
              id: randomUUID(),
              name: 'Duplicate',
              slug: `test-${f.country}`,
              type: 'COUNTRY',
            });
            break;
          case 'parent-tier':
            await tx.geoEntity.update({
              where: { id: f.destination },
              data: { parentId: f.destination },
            });
            break;
          case 'type-fk':
            await tx.entityRelation.create({
              data: {
                sourceId: f.country,
                sourceKind: 'PLACE',
                targetId: f.experience,
                targetKind: 'EXPERIENCE',
                type: 'HAS_EXPERIENCE',
              },
            });
            break;
          case 'dangling-fk':
            await repo.createRelation({
              sourceId: f.country,
              sourceKind: 'GEO_ENTITY',
              targetId: randomUUID(),
              targetKind: 'PLACE',
              type: 'HAS_ATTRACTION',
            });
            break;
          case 'invalid-relation':
            await repo.createRelation({
              sourceId: f.experience,
              sourceKind: 'EXPERIENCE',
              targetId: f.place,
              targetKind: 'PLACE',
              type: 'HAS_ATTRACTION',
            });
            break;
          case 'duplicate-edge':
            for (let i = 0; i < 2; i++)
              await f.service.createRelation({
                sourceId: f.country,
                sourceKind: 'GEO_ENTITY',
                targetId: f.destination,
                targetKind: 'GEO_ENTITY',
                type: 'NEAR',
              });
            break;
          case 'wrong-part-of':
            await repo.createRelation({
              sourceId: f.place,
              sourceKind: 'PLACE',
              targetId: f.country,
              targetKind: 'GEO_ENTITY',
              type: 'PART_OF',
            });
            break;
          case 'unverified-publication':
            await tx.entityRegistry.update({
              where: { id: f.country },
              data: { status: 'PUBLISHED' },
            });
            break;
          case 'fixture-publication':
            await tx.sourceRecord.update({
              where: { id: f.source.id },
              data: { sourceType: 'DEVELOPMENT_FIXTURE' },
            });
            await publish(tx, [f.country]);
            break;
          case 'owner-identity':
            await tx.$executeRaw`UPDATE place SET id=${randomUUID()}::uuid WHERE id=${f.place}::uuid`;
            break;
          case 'reparent-edge':
            await f.service.createRelation({
              sourceId: f.place,
              sourceKind: 'PLACE',
              targetId: f.destination,
              targetKind: 'GEO_ENTITY',
              type: 'PART_OF',
            });
            await tx.place.update({
              where: { id: f.place },
              data: { geoEntityId: f.country },
            });
            break;
          case 'confidence':
            await tx.entitySource.create({
              data: {
                entityId: f.country,
                sourceId: f.source.id,
                confidence: 2,
              },
            });
            break;
          case 'missing-owner':
            await tx.entityRegistry.create({
              data: {
                id: randomUUID(),
                kind: 'PLACE',
                name: 'Orphan',
                slug: `orphan-${randomUUID()}`,
              },
            });
            break;
          case 'reserved-owner':
            await tx.entityRegistry.create({
              data: {
                id: randomUUID(),
                kind: 'PARTNER',
                name: 'Not implemented',
                slug: `reserved-${randomUUID()}`,
              },
            });
            break;
          case 'future-verification':
            await tx.entityRegistry.update({
              where: { id: f.country },
              data: { lastVerified: new Date('2100-01-01T00:00:00Z') },
            });
            break;
          case 'source-delete':
            await tx.sourceRecord.delete({ where: { id: f.source.id } });
            break;
        }
        await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      }),
    ).rejects.toThrow();
    expect(
      await client.sourceRecord.findUnique({ where: { sourceKey: marker } }),
    ).toBeNull();
  },
);
test('seed is idempotent, sourced, draft-only and preserves edited entities', async () => {
  await seedKnowledgeGraph(client);
  const before = await client.entityRegistry.count({
    where: {
      id: {
        in: [
          seedId(1),
          seedId(3),
          seedId(4),
          seedId(5),
          seedId(7),
          seedId(9),
          seedId(11),
        ],
      },
    },
  });
  expect(before).toBe(7);
  const relationCount = await client.entityRelation.count({
    where: { sourceRecordId: seedId(900) },
  });
  const original = await client.entityRegistry.findUniqueOrThrow({
    where: { id: seedId(22) },
  });
  try {
    await client.entityRegistry.update({
      where: { id: seedId(22) },
      data: { name: 'Locally edited guide reference' },
    });
    await seedKnowledgeGraph(client);
    expect(
      (
        await client.entityRegistry.findUniqueOrThrow({
          where: { id: seedId(22) },
        })
      ).name,
    ).toBe('Locally edited guide reference');
  } finally {
    await client.entityRegistry.update({
      where: { id: seedId(22) },
      data: { name: original.name },
    });
  }
  const drafts = await client.entityRegistry.findMany({
    where: {
      id: {
        in: [
          seedId(1),
          seedId(3),
          seedId(4),
          seedId(5),
          seedId(7),
          seedId(9),
          seedId(11),
        ],
      },
    },
  });
  expect(
    drafts.every(
      (e) =>
        e.status === 'DRAFT' &&
        e.lastVerified === null &&
        e.primarySourceId !== null,
    ),
  ).toBe(true);
  expect(
    await client.entityRelation.count({
      where: { sourceRecordId: original.primarySourceId! },
    }),
  ).toBe(relationCount);
});

test('verification uses wall clock within a transaction and fact-level sources round-trip', async () => {
  await rollback(async (repo, tx) => {
    const f = await fixture(repo, tx);
    await tx.$executeRaw`UPDATE entity_registry SET status='PUBLISHED', last_verified=clock_timestamp() WHERE id=${f.destination}::uuid`;
    expect((await repo.findGeo(f.destination))?.status).toBe('PUBLISHED');
    await tx.entitySource.createMany({
      data: [
        {
          entityId: f.destination,
          sourceId: f.source.id,
          factPath: 'location',
          confidence: 0.9,
          reviewer: 'Test reviewer',
          lastVerified: await verifiedTime(tx),
        },
        {
          entityId: f.destination,
          sourceId: f.source.id,
          factPath: 'name',
          confidence: 1,
        },
      ],
    });
    expect(
      await tx.entitySource.count({ where: { entityId: f.destination } }),
    ).toBe(2);
  });
});

test('per-kind/locale slugs allow distinct scopes while reserving withdrawn URLs', async () => {
  await rollback(async (repo, tx) => {
    const f = await fixture(repo, tx);
    const sameSlug = `test-${f.country}`;
    await repo.createGeo({
      id: randomUUID(),
      name: 'Other locale',
      slug: sameSlug,
      locale: 'ur',
      type: 'COUNTRY',
    });
    await repo.createPlace({
      id: randomUUID(),
      name: 'Other kind',
      slug: sameSlug,
      geoEntityId: f.destination,
      type: 'ATTRACTION',
    });
    await tx.entityRegistry.update({
      where: { id: f.country },
      data: { status: 'WITHDRAWN', deletedAt: new Date() },
    });
    expect(
      await tx.entityRegistry.findUnique({
        where: {
          kind_locale_slug: {
            kind: 'GEO_ENTITY',
            locale: 'en',
            slug: sameSlug,
          },
        },
      }),
    ).toMatchObject({ id: f.country, status: 'WITHDRAWN' });
    await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  });
});

test('controlled migration creates both WGS84 GiST proximity indexes', async () => {
  const indexes = await client.$queryRaw<
    Array<{ indexname: string; indexdef: string }>
  >`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('geo_entity_location_gist','place_location_gist')`;
  expect(indexes).toHaveLength(2);
  expect(
    indexes.every((i) => i.indexdef.includes('USING gist (location)')),
  ).toBe(true);
});

test('Sprint 1 representative geography and destination profiles are idempotent unverified drafts', async () => {
  await seedKnowledgeGraph(client);
  await seedDestinationProfiles(client);
  await seedDestinationProfiles(client);
  const rows = await client.geoEntity.findMany({
    where: { id: { in: seedGeography.map((g) => g.id) } },
    include: { entity: true, destinationProfile: true },
  });
  expect(rows).toHaveLength(18);
  expect(
    rows
      .filter((g) => g.type === 'PROVINCE_TERRITORY')
      .map((g) => g.entity.name)
      .sort(),
  ).toEqual([
    'Azad Jammu & Kashmir',
    'Balochistan',
    'Gilgit-Baltistan',
    'Islamabad Capital Territory',
    'Khyber Pakhtunkhwa',
    'Punjab',
    'Sindh',
  ]);
  expect(
    rows
      .filter((g) => g.destinationProfile)
      .map((g) => g.entity.slug)
      .sort(),
  ).toEqual([
    'chitral',
    'hunza',
    'islamabad',
    'karachi',
    'lahore',
    'murree',
    'naran-kaghan',
    'skardu',
    'swat',
  ]);
  for (const row of rows) {
    const input = seedGeography.find((g) => g.id === row.id)!;
    expect(row.parentId).toBe(input.parentId ?? null);
    expect(row.entity.status).toBe('DRAFT');
    expect(row.entity.lastVerified).toBeNull();
    if (row.destinationProfile)
      expect(row.destinationProfile).toMatchObject({
        status: 'DRAFT',
        interests: [],
        seasons: [],
      });
  }
});
