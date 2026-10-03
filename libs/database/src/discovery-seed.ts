import {
  KnowledgeGraphService,
  normalizeRelation,
  type PlaceInput,
  type ExperienceInput,
  type RelationInput,
} from '@visitspakistan/domain';
import type { PrismaClient } from './generated/client';
import { graphTransaction } from './knowledge-graph.repository';
import { seedId, seedSourceId } from './seed';
export const attractionSeeds: PlaceInput[] = [
  {
    id: seedId(23),
    name: 'Baltit Fort',
    slug: 'baltit-fort',
    type: 'LANDMARK',
    category: 'HERITAGE',
    geoEntityId: seedId(4),
    coordinates: { latitude: 36.3255, longitude: 74.6694 },
  },
  {
    id: seedId(24),
    name: 'Passu Cones',
    slug: 'passu-cones',
    type: 'NATURAL_ATTRACTION',
    category: 'NATURE',
    geoEntityId: seedId(4),
    coordinates: { latitude: 36.4693, longitude: 74.8895 },
  },
  {
    id: seedId(25),
    name: 'Deosai',
    slug: 'deosai',
    type: 'NATURAL_ATTRACTION',
    category: 'NATURE',
    geoEntityId: seedId(5),
    coordinates: { latitude: 34.9633, longitude: 75.4144 },
  },
  {
    id: seedId(26),
    name: 'Badshahi Mosque',
    slug: 'badshahi-mosque',
    type: 'LANDMARK',
    category: 'HERITAGE',
    geoEntityId: seedId(9),
    coordinates: { latitude: 31.588, longitude: 74.3107 },
  },
  {
    id: seedId(27),
    name: 'Lahore Fort',
    slug: 'lahore-fort',
    type: 'LANDMARK',
    category: 'HERITAGE',
    geoEntityId: seedId(9),
    coordinates: { latitude: 31.5883, longitude: 74.315 },
  },
  {
    id: seedId(28),
    name: 'Faisal Mosque',
    slug: 'faisal-mosque',
    type: 'LANDMARK',
    category: 'HERITAGE',
    geoEntityId: seedId(7),
    coordinates: { latitude: 33.7294, longitude: 73.0379 },
  },
  {
    id: seedId(29),
    name: 'Margalla Hills',
    slug: 'margalla-hills',
    type: 'NATURAL_ATTRACTION',
    category: 'NATURE',
    geoEntityId: seedId(7),
    coordinates: { latitude: 33.751, longitude: 73.041 },
  },
];
export const experienceSeeds: ExperienceInput[] = [
  { id: seedId(40), name: 'Trekking', slug: 'trekking', category: 'TREKKING' },
  {
    id: seedId(41),
    name: 'Food Walk',
    slug: 'food-walk',
    category: 'FOOD_WALK',
  },
  {
    id: seedId(42),
    name: 'Heritage Tour',
    slug: 'heritage-tour',
    category: 'HERITAGE_TOUR',
  },
  {
    id: seedId(43),
    name: 'Photography',
    slug: 'photography',
    category: 'PHOTOGRAPHY',
  },
  { id: seedId(44), name: 'Camping', slug: 'camping', category: 'CAMPING' },
  { id: seedId(45), name: 'Skiing', slug: 'skiing', category: 'SKIING' },
];
/** All insert-only unverified development fixtures; no hours, fees or suitability claims. */
export async function seedDiscovery(client: PrismaClient) {
  await graphTransaction(client, async (repo, tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(17320603)`;
    const service = new KnowledgeGraphService(repo);
    for (const input of attractionSeeds)
      if (!(await tx.entityRegistry.findUnique({ where: { id: input.id } })))
        await service.createPlace({ ...input, primarySourceId: seedSourceId });
    for (const input of experienceSeeds)
      if (!(await tx.entityRegistry.findUnique({ where: { id: input.id } })))
        await service.createExperience({
          ...input,
          primarySourceId: seedSourceId,
        });
    const rel = (
      source: number,
      sourceKind: RelationInput['sourceKind'],
      type: RelationInput['type'],
      target: number,
      targetKind: RelationInput['targetKind'],
    ): RelationInput => ({
      sourceId: seedId(source),
      sourceKind,
      type,
      targetId: seedId(target),
      targetKind,
      sourceRecordId: seedSourceId,
    });
    const relations: RelationInput[] = attractionSeeds.map((p) => ({
      sourceId: p.geoEntityId,
      sourceKind: 'GEO_ENTITY',
      type: 'HAS_ATTRACTION',
      targetId: p.id,
      targetKind: 'PLACE',
      sourceRecordId: seedSourceId,
    }));
    relations.push(
      rel(4, 'GEO_ENTITY', 'HAS_EXPERIENCE', 21, 'EXPERIENCE'),
      rel(4, 'GEO_ENTITY', 'HAS_EXPERIENCE', 43, 'EXPERIENCE'),
      rel(5, 'GEO_ENTITY', 'HAS_EXPERIENCE', 44, 'EXPERIENCE'),
      rel(9, 'GEO_ENTITY', 'HAS_EXPERIENCE', 42, 'EXPERIENCE'),
      rel(7, 'GEO_ENTITY', 'HAS_EXPERIENCE', 40, 'EXPERIENCE'),
      rel(23, 'PLACE', 'HAS_EXPERIENCE', 42, 'EXPERIENCE'),
      rel(24, 'PLACE', 'HAS_EXPERIENCE', 43, 'EXPERIENCE'),
      rel(25, 'PLACE', 'HAS_EXPERIENCE', 44, 'EXPERIENCE'),
      rel(26, 'PLACE', 'HAS_EXPERIENCE', 42, 'EXPERIENCE'),
      rel(27, 'PLACE', 'HAS_EXPERIENCE', 42, 'EXPERIENCE'),
      rel(29, 'PLACE', 'HAS_EXPERIENCE', 40, 'EXPERIENCE'),
      rel(26, 'PLACE', 'NEAR', 27, 'PLACE'),
    );
    for (const raw of relations) {
      const r = normalizeRelation(raw);
      if (
        !(await tx.entityRelation.findUnique({
          where: {
            sourceId_type_targetId: {
              sourceId: r.sourceId,
              type: r.type,
              targetId: r.targetId,
            },
          },
        }))
      )
        await service.createRelation(r);
    }
  });
}
