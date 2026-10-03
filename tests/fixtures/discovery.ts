import { randomUUID } from 'node:crypto';
import {
  KnowledgeGraphService,
  blockTypes,
  normalizeRelation,
} from '@visitspakistan/domain';
import { graphTransaction } from '@visitspakistan/database';
import type { PrismaClient } from '../../libs/database/src/generated/client';
import { destinationFixture } from './destinations';
export async function discoveryFixture(db: PrismaClient, root: string) {
  const f = await destinationFixture(db, root);
  const neighbour = randomUUID(),
    photo = randomUUID(),
    unknown = randomUUID();
  const edgeSource = await db.sourceRecord.create({
    data: {
      sourceKey: `discovery-edge:${randomUUID()}`,
      title: 'Synthetic nearby relationship evidence',
      publisher: 'Isolated discovery test',
      url: 'https://example.invalid/discovery-edge',
      sourceType: 'EDITORIAL',
      accessedAt: f.time,
    },
  });
  await graphTransaction(db, async (repo, tx) => {
    const service = new KnowledgeGraphService(repo);
    await tx.place.update({
      where: { id: f.attraction },
      data: {
        altNames: ['Synthetic lake'],
        summary: 'Synthetic lake facts for isolated verification.',
        category: 'NATURE',
        openingInformation: 'Synthetic opening information; not travel advice.',
        admissionInformation:
          'Synthetic admission information; not a real fee.',
        durationMinutes: 90,
        bestTime: 'Synthetic reviewed seasonal note.',
        seasons: ['summer'],
        familySuitable: true,
        accessibility: 'Synthetic accessibility note.',
        facilities: ['Synthetic visitor facility'],
      },
    });
    await tx.$executeRaw`UPDATE place SET location=ST_SetSRID(ST_MakePoint(74.867,36.337),4326)::geography WHERE id=${f.attraction}::uuid`;
    await tx.experience.update({
      where: { id: f.experience },
      data: {
        summary: 'Synthetic boating concept, not a commercial product.',
        durationMinutes: 45,
        familySuitable: false,
        seasons: ['summer'],
      },
    });
    await service.createPlace({
      id: neighbour,
      name: 'Baltit Fort (test)',
      slug: `baltit-${neighbour}`,
      type: 'LANDMARK',
      category: 'HERITAGE',
      geoEntityId: f.hunza,
      coordinates: { latitude: 36.337, longitude: 74.869 },
      seasons: ['all-year'],
      primarySourceId: f.source.id,
    });
    await service.createExperience({
      id: photo,
      name: 'Photography (test)',
      slug: `photography-${photo}`,
      category: 'PHOTOGRAPHY',
      geoEntityId: f.hunza,
      durationMinutes: 120,
      seasons: ['all-year'],
      familySuitable: true,
      primarySourceId: f.source.id,
    });
    await service.createExperience({
      id: unknown,
      name: 'Camping concept (test)',
      slug: `camping-${unknown}`,
      category: 'CAMPING',
      primarySourceId: f.source.id,
    });
    await tx.entityRegistry.updateMany({
      where: { id: { in: [neighbour, photo, unknown] } },
      data: { status: 'PUBLISHED', lastVerified: f.time },
    });
    for (const input of [
      {
        sourceId: f.hunza,
        sourceKind: 'GEO_ENTITY' as const,
        type: 'HAS_ATTRACTION' as const,
        targetId: neighbour,
        targetKind: 'PLACE' as const,
        sourceRecordId: f.source.id,
      },
      {
        sourceId: f.hunza,
        sourceKind: 'GEO_ENTITY' as const,
        type: 'HAS_EXPERIENCE' as const,
        targetId: photo,
        targetKind: 'EXPERIENCE' as const,
        sourceRecordId: f.source.id,
      },
      {
        sourceId: f.attraction,
        sourceKind: 'PLACE' as const,
        type: 'HAS_EXPERIENCE' as const,
        targetId: photo,
        targetKind: 'EXPERIENCE' as const,
        sourceRecordId: f.source.id,
      },
      {
        sourceId: f.attraction,
        sourceKind: 'PLACE' as const,
        type: 'NEAR' as const,
        targetId: neighbour,
        targetKind: 'PLACE' as const,
        sourceRecordId: edgeSource.id,
      },
    ])
      await tx.entityRelation.create({
        data: {
          ...normalizeRelation(input),
          status: 'PUBLISHED',
          lastVerified: f.time,
        },
      });
  });
  const prior = await db.templateAssignment.findMany({
    where: { type: { in: ['ATTRACTION_EDITORIAL', 'EXPERIENCE_EDITORIAL'] } },
  });
  const template = await db.siteTemplate.create({
    data: {
      name: 'Discovery test editorial',
      slug: `discovery-${randomUUID()}`,
      layout: 'EDITORIAL',
      allowedBlocks: [...blockTypes],
    },
  });
  for (const type of ['ATTRACTION_EDITORIAL', 'EXPERIENCE_EDITORIAL'] as const)
    await db.templateAssignment.upsert({
      where: { type },
      create: { type, templateId: template.id },
      update: { templateId: template.id },
    });
  const docs: string[] = [];
  for (const [primaryEntityId, type, title] of [
    [f.attraction, 'ATTRACTION_EDITORIAL', 'Attabad Lake editorial (test)'],
    [f.experience, 'EXPERIENCE_EDITORIAL', 'Boating concept editorial (test)'],
  ] as const) {
    let d = await f.store.create(f.author, {
      type,
      slug: `discovery-editorial-${randomUUID()}`,
      locale: 'en',
      primaryEntityId,
      body: {
        title,
        summary:
          'A synthetic editorial for verifying connected discovery pages.',
        seoTitle: `${title} | VisitsPakistan`,
        metaDescription:
          'Synthetic editorial content used exclusively to verify canonical references and published discovery rendering in the isolated test database.',
        blocks: [
          {
            type: 'paragraph',
            text: 'An independently reviewed synthetic story, with no commercial offers or unsupported travel claims.',
          },
        ],
        sourceIds: [f.source.id],
        canonicalIds: [primaryEntityId],
        heroMediaId: f.hero.id,
        lastVerified: f.time.toISOString(),
      },
    });
    for (const action of ['submit', 'approve', 'publish'] as const)
      d = await f.store.action(
        action === 'submit' ? f.author : f.editor,
        d.id,
        { action, expectedVersion: d.version },
      );
    docs.push(d.id);
  }
  return {
    ...f,
    neighbour,
    photo,
    unknown,
    edgeSource,
    docs,
    placeSlug: `place-${f.attraction}`,
    experienceSlug: `experience-${f.experience}`,
    neighbourSlug: `baltit-${neighbour}`,
    photoSlug: `photography-${photo}`,
    unknownSlug: `camping-${unknown}`,
    async cleanup() {
      await db.editorialDocument.updateMany({
        where: { id: { in: docs } },
        data: { publishedRevisionId: null },
      });
      await db.entityRegistry.updateMany({
        where: { id: { in: [neighbour, photo, unknown, ...docs] } },
        data: { status: 'WITHDRAWN', deletedAt: new Date() },
      });
      await db.sourceRecord.update({
        where: { id: edgeSource.id },
        data: { retiredAt: new Date() },
      });
      for (const type of [
        'ATTRACTION_EDITORIAL',
        'EXPERIENCE_EDITORIAL',
      ] as const) {
        const p = prior.find((p) => p.type === type);
        if (p)
          await db.templateAssignment.update({
            where: { type },
            data: { templateId: p.templateId },
          });
        else await db.templateAssignment.deleteMany({ where: { type } });
      }
      await f.cleanup();
    },
  };
}
