import { randomUUID } from 'node:crypto';
import { graphTransaction } from '@visitspakistan/database';
import {
  KnowledgeGraphService,
  normalizeRelation,
  type SearchType,
} from '@visitspakistan/domain';
import type { PrismaClient } from '../../libs/database/src/generated/client';
import { discoveryFixture } from './discovery';
export async function searchFixture(db: PrismaClient, root: string) {
  const f = await discoveryFixture(db, root),
    created: string[] = [];
  const ids: Record<string, string> = {
    hunza: f.hunza,
    skardu: f.skardu,
    attabad: f.attraction,
    baltit: f.neighbour,
    boating: f.experience,
    photography: f.photo,
  };
  await db.geoEntity.update({
    where: { id: f.hunza },
    data: { altNames: ['Hunza Valley', 'ہنزہ', 'Hunza Wadi'] },
  });
  await db.geoEntity.update({
    where: { id: f.region },
    data: { altNames: ['Northern Areas'] },
  });
  await db.geoEntity.update({
    where: { id: f.skardu },
    data: { altNames: ['سکردو'] },
  });
  await db.place.update({
    where: { id: f.attraction },
    data: { altNames: ['Attabad Jheel', 'عطا آباد جھیل'] },
  });
  const slugs: Record<string, string> = {
    hunza: f.hunzaSlug,
    skardu: f.skarduSlug,
  };
  const country = (
    await db.geoEntity.findUniqueOrThrow({ where: { id: f.region } })
  ).parentId!;
  const dests = [
    ['lahore', 'Lahore', ['لاہور']],
    ['islamabad', 'Islamabad', ['اسلام آباد']],
    ['karachi', 'Karachi', ['کراچی']],
    ['swat', 'Swat', ['Swat Valley', 'سوات']],
    ['chitral', 'Chitral', ['چترال']],
    ['naran', 'Naran Kaghan', ['Naran', 'Kaghan']],
    ['murree', 'Murree', ['مری']],
  ] as const;
  await graphTransaction(db, async (repo, tx) => {
    const graph = new KnowledgeGraphService(repo);
    for (const [key, name, alt] of dests) {
      const id = randomUUID();
      ids[key] = id;
      created.push(id);
      slugs[key] = `${key}-${id}`;
      await graph.createGeo({
        id,
        name,
        slug: slugs[key]!,
        type: 'CITY',
        parentId: country,
        altNames: [...alt],
        summary: 'Synthetic Pakistan search relevance fixture',
        primarySourceId: f.source.id,
      });
      await tx.entityRegistry.update({
        where: { id },
        data: { status: 'PUBLISHED', lastVerified: f.time },
      });
      await tx.destinationProfile.create({
        data: {
          id,
          sourceId: f.source.id,
          status: 'PUBLISHED',
          lastVerified: f.time,
          interests: ['heritage'],
          seasons: [],
        },
      });
    }
    for (const [key, name, destination, category, alt] of [
      ['passu', 'Passu Cones', 'hunza', 'nature', ['Passu Cathedral']],
      ['deosai', 'Deosai', 'skardu', 'nature', ['Deosai Plains']],
      ['badshahi', 'Badshahi Mosque', 'lahore', 'heritage', ['بادشاہی مسجد']],
      ['lahorefort', 'Lahore Fort', 'lahore', 'heritage', ['Shahi Qila']],
      ['faisal', 'Faisal Mosque', 'islamabad', 'heritage', ['فیصل مسجد']],
      [
        'margalla',
        'Margalla Hills',
        'islamabad',
        'nature',
        ['Margalla trails'],
      ],
    ] as const) {
      const id = randomUUID();
      ids[key] = id;
      created.push(id);
      await graph.createPlace({
        id,
        name,
        slug: `${key}-${id}`,
        type: 'ATTRACTION',
        geoEntityId: ids[destination]!,
        category,
        altNames: [...alt],
        summary: 'Synthetic attraction evidence for search testing',
        primarySourceId: f.source.id,
        coordinates: { latitude: 35, longitude: 74 },
      });
      await tx.entityRegistry.update({
        where: { id },
        data: { status: 'PUBLISHED', lastVerified: f.time },
      });
      const relation = normalizeRelation({
        sourceId: ids[destination]!,
        sourceKind: 'GEO_ENTITY',
        targetId: id,
        targetKind: 'PLACE',
        type: 'HAS_ATTRACTION',
        sourceRecordId: f.source.id,
      });
      await tx.entityRelation.create({
        data: {
          sourceId: relation.sourceId,
          sourceKind: relation.sourceKind,
          targetId: relation.targetId,
          targetKind: relation.targetKind,
          type: relation.type,
          sourceRecordId: f.source.id,
          status: 'PUBLISHED',
          lastVerified: f.time,
        },
      });
    }
    for (const [key, name, destination, category, aliases] of [
      ['trekking', 'Trekking', 'hunza', 'trekking', ['Hiking', 'پیدل سفر']],
      ['camping', 'Camping', 'skardu', 'camping', ['Campsite']],
      ['foodwalk', 'Food Walk', 'lahore', 'food', ['Food walking tour']],
      ['heritage', 'Heritage Tour', 'lahore', 'heritage', ['History walk']],
      ['skiing', 'Skiing', 'swat', 'skiing', []],
    ] as const) {
      const id = randomUUID();
      ids[key] = id;
      created.push(id);
      await graph.createExperience({
        id,
        name,
        slug: `${key}-${id}`,
        category,
        altNames: [...aliases],
        primarySourceId: f.source.id,
        familySuitable: key === 'heritage' ? true : undefined,
      });
      await tx.entityRegistry.update({
        where: { id },
        data: { status: 'PUBLISHED', lastVerified: f.time },
      });
      await tx.entityRelation.create({
        data: {
          sourceId: ids[destination]!,
          sourceKind: 'GEO_ENTITY',
          targetId: id,
          targetKind: 'EXPERIENCE',
          type: 'HAS_EXPERIENCE',
          sourceRecordId: f.source.id,
          status: 'PUBLISHED',
          lastVerified: f.time,
        },
      });
    }
  });
  return {
    ...f,
    ids,
    slugs,
    async cleanup() {
      await db.entityRegistry.updateMany({
        where: { id: { in: created } },
        data: { status: 'WITHDRAWN', deletedAt: new Date() },
      });
      await db.destinationProfile.updateMany({
        where: { id: { in: created } },
        data: { status: 'WITHDRAWN', deletedAt: new Date() },
      });
      await f.cleanup();
    },
  };
}
export type RelevanceCase = {
  q: string;
  expected: string;
  type?: SearchType;
  autocomplete?: boolean;
};
