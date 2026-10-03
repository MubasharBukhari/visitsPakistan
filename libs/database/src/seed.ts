import {
  KnowledgeGraphService,
  normalizeRelation,
} from '@visitspakistan/domain';
import type { GeoInput, RelationInput } from '@visitspakistan/domain';
import type { PrismaClient } from './generated/client';
import { graphTransaction } from './knowledge-graph.repository';
export const seedId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const seedSourceId = seedId(900);
export const seedGeography: GeoInput[] = [
  {
    id: seedId(1),
    name: 'Pakistan',
    slug: 'pakistan',
    type: 'COUNTRY',
    coordinates: { latitude: 30.3753, longitude: 69.3451 },
  },
  {
    id: seedId(2),
    name: 'Northern Pakistan',
    slug: 'northern-pakistan',
    type: 'REGION',
    parentId: seedId(1),
  },
  {
    id: seedId(3),
    name: 'Gilgit-Baltistan',
    slug: 'gilgit-baltistan',
    type: 'PROVINCE_TERRITORY',
    parentId: seedId(2),
    coordinates: { latitude: 35.8026, longitude: 74.9838 },
  },
  {
    id: seedId(4),
    name: 'Hunza',
    slug: 'hunza',
    type: 'DESTINATION',
    parentId: seedId(3),
    coordinates: { latitude: 36.3167, longitude: 74.65 },
  },
  {
    id: seedId(5),
    name: 'Skardu',
    slug: 'skardu',
    type: 'CITY',
    parentId: seedId(3),
    coordinates: { latitude: 35.2971, longitude: 75.6333 },
  },
  {
    id: seedId(6),
    name: 'Islamabad Capital Territory',
    slug: 'islamabad-capital-territory',
    type: 'PROVINCE_TERRITORY',
    parentId: seedId(1),
  },
  {
    id: seedId(7),
    name: 'Islamabad',
    slug: 'islamabad',
    type: 'CITY',
    parentId: seedId(6),
    coordinates: { latitude: 33.6844, longitude: 73.0479 },
  },
  {
    id: seedId(8),
    name: 'Punjab',
    slug: 'punjab',
    type: 'PROVINCE_TERRITORY',
    parentId: seedId(1),
  },
  {
    id: seedId(9),
    name: 'Lahore',
    slug: 'lahore',
    type: 'CITY',
    parentId: seedId(8),
    coordinates: { latitude: 31.5204, longitude: 74.3587 },
  },
  {
    id: seedId(10),
    name: 'Sindh',
    slug: 'sindh',
    type: 'PROVINCE_TERRITORY',
    parentId: seedId(1),
  },
  {
    id: seedId(11),
    name: 'Karachi',
    slug: 'karachi',
    type: 'CITY',
    parentId: seedId(10),
    coordinates: { latitude: 24.8607, longitude: 67.0011 },
  },
  {
    id: seedId(12),
    name: 'Khyber Pakhtunkhwa',
    slug: 'khyber-pakhtunkhwa',
    type: 'PROVINCE_TERRITORY',
    parentId: seedId(1),
  },
  {
    id: seedId(13),
    name: 'Balochistan',
    slug: 'balochistan',
    type: 'PROVINCE_TERRITORY',
    parentId: seedId(1),
  },
  {
    id: seedId(14),
    name: 'Azad Jammu & Kashmir',
    slug: 'azad-jammu-kashmir',
    type: 'PROVINCE_TERRITORY',
    parentId: seedId(1),
    altNames: ['AJK', 'Azad Kashmir'],
  },
  {
    id: seedId(15),
    name: 'Swat',
    slug: 'swat',
    type: 'DESTINATION',
    parentId: seedId(12),
    coordinates: { latitude: 35.2227, longitude: 72.4258 },
  },
  {
    id: seedId(16),
    name: 'Chitral',
    slug: 'chitral',
    type: 'CITY',
    parentId: seedId(12),
    coordinates: { latitude: 35.8518, longitude: 71.7864 },
  },
  {
    id: seedId(17),
    name: 'Naran / Kaghan',
    slug: 'naran-kaghan',
    type: 'DESTINATION',
    parentId: seedId(12),
    altNames: ['Naran', 'Kaghan Valley'],
    summary:
      'Development discovery-area grouping; geographic extent and naming require review.',
    coordinates: { latitude: 34.9042, longitude: 73.648 },
  },
  {
    id: seedId(18),
    name: 'Murree',
    slug: 'murree',
    type: 'CITY',
    parentId: seedId(8),
    coordinates: { latitude: 33.907, longitude: 73.3943 },
  },
];
/** Idempotent insert-only fixtures: never overwrite names/status/coordinates edited by users. */
export async function seedKnowledgeGraph(client: PrismaClient): Promise<void> {
  await graphTransaction(client, async (repo, tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(17320602)`;
    await tx.sourceRecord.upsert({
      where: { sourceKey: 'development:canonical-graph:v1' },
      update: {},
      create: {
        id: seedSourceId,
        sourceKey: 'development:canonical-graph:v1',
        title: 'VisitsPakistan development graph fixtures',
        publisher: 'VisitsPakistan engineering',
        accessedAt: new Date('2026-10-02T00:00:00Z'),
        sourceType: 'DEVELOPMENT_FIXTURE',
        metadata: {
          approximateCoordinates: true,
          verified: false,
          purpose:
            'Local development only; requires independent source review before publication',
          regionGrouping:
            'Northern Pakistan is an editorial grouping, not an administrative boundary',
        },
      },
    });
    const service = new KnowledgeGraphService(repo);
    const source = { primarySourceId: seedSourceId };
    for (const geo of seedGeography)
      if (!(await tx.entityRegistry.findUnique({ where: { id: geo.id } })))
        await service.createGeo({ ...geo, ...source });
    if (!(await tx.entityRegistry.findUnique({ where: { id: seedId(20) } })))
      await service.createPlace({
        id: seedId(20),
        name: 'Attabad Lake',
        slug: 'attabad-lake',
        type: 'ATTRACTION',
        geoEntityId: seedId(4),
        coordinates: { latitude: 36.337, longitude: 74.867 },
        ...source,
      });
    if (!(await tx.entityRegistry.findUnique({ where: { id: seedId(21) } })))
      await service.createExperience({
        id: seedId(21),
        name: 'Lake boating',
        slug: 'lake-boating',
        category: 'BOATING',
        geoEntityId: seedId(4),
        ...source,
      });
    if (!(await tx.entityRegistry.findUnique({ where: { id: seedId(22) } })))
      await service.createContent({
        id: seedId(22),
        name: 'Hunza guide reference',
        slug: 'hunza-guide-reference',
        type: 'GUIDE',
        primaryEntityId: seedId(4),
        ...source,
      });
    const relations: RelationInput[] = seedGeography
      .filter((g) => g.parentId)
      .map((g) => ({
        sourceId: g.id,
        sourceKind: 'GEO_ENTITY',
        type: 'PART_OF',
        targetId: g.parentId!,
        targetKind: 'GEO_ENTITY',
        sourceRecordId: seedSourceId,
      }));
    relations.push(
      {
        sourceId: seedId(4),
        sourceKind: 'GEO_ENTITY',
        type: 'HAS_ATTRACTION',
        targetId: seedId(20),
        targetKind: 'PLACE',
      },
      {
        sourceId: seedId(20),
        sourceKind: 'PLACE',
        type: 'HAS_EXPERIENCE',
        targetId: seedId(21),
        targetKind: 'EXPERIENCE',
      },
      {
        sourceId: seedId(21),
        sourceKind: 'EXPERIENCE',
        type: 'VISITS',
        targetId: seedId(20),
        targetKind: 'PLACE',
      },
      {
        sourceId: seedId(22),
        sourceKind: 'CONTENT_ITEM',
        type: 'ABOUT',
        targetId: seedId(4),
        targetKind: 'GEO_ENTITY',
      },
      {
        sourceId: seedId(20),
        sourceKind: 'PLACE',
        type: 'PART_OF',
        targetId: seedId(4),
        targetKind: 'GEO_ENTITY',
      },
      {
        sourceId: seedId(21),
        sourceKind: 'EXPERIENCE',
        type: 'PART_OF',
        targetId: seedId(4),
        targetKind: 'GEO_ENTITY',
      },
      {
        sourceId: seedId(4),
        sourceKind: 'GEO_ENTITY',
        type: 'NEAR',
        targetId: seedId(20),
        targetKind: 'PLACE',
      },
    );
    for (const input of relations) {
      const relation = normalizeRelation({
        ...input,
        sourceRecordId: seedSourceId,
      });
      const exists = await tx.entityRelation.findUnique({
        where: {
          sourceId_type_targetId: {
            sourceId: relation.sourceId,
            type: relation.type,
            targetId: relation.targetId,
          },
        },
      });
      if (!exists) await service.createRelation(relation);
    }
  });
}

/** Insert-only profiles share canonical geography identity; no season claims are seeded. */
export async function seedDestinationProfiles(client: PrismaClient) {
  await client.destinationProfile.createMany({
    data: seedGeography
      .filter((g) => g.type === 'CITY' || g.type === 'DESTINATION')
      .map((g) => ({
        id: g.id,
        sourceId: seedSourceId,
        interests: [],
        seasons: [],
      })),
    skipDuplicates: true,
  });
}
