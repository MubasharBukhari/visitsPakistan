import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  KnowledgeGraphService,
  blockTypes,
  type CmsActor,
} from '@visitspakistan/domain';
import {
  graphTransaction,
  EditorialStore,
  MediaStore,
} from '@visitspakistan/database';
import type { PrismaClient } from '../../libs/database/src/generated/client';
/** Synthetic fixtures only: never create approved test travel data in the development database. */
export async function destinationFixture(db: PrismaClient, mediaRoot: string) {
  const [database] = await db.$queryRaw<
    Array<{ name: string }>
  >`SELECT current_database() AS name`;
  if (!database?.name.endsWith('_test'))
    throw new Error('Destination fixtures require an isolated _test database');
  const suffix = randomUUID();
  const time = new Date(Date.now() - 60000);
  const source = await db.sourceRecord.create({
    data: {
      sourceKey: `destination-test:${suffix}`,
      title: 'Synthetic destination integration evidence',
      publisher: 'Isolated VisitsPakistan test',
      url: 'https://example.invalid/destination-test-evidence',
      sourceType: 'EDITORIAL',
      accessedAt: time,
    },
  });
  const country = randomUUID(),
    region = randomUUID(),
    province = randomUUID(),
    hunza = randomUUID(),
    skardu = randomUUID(),
    attraction = randomUUID(),
    experience = randomUUID(),
    restaurant = randomUUID(),
    draftAttraction = randomUUID();
  const hunzaSlug = `hunza-${suffix}`,
    skarduSlug = `skardu-${suffix}`,
    regionSlug = `northern-${suffix}`,
    provinceSlug = `gilgit-baltistan-${suffix}`;
  const canonicalIds = [
    country,
    region,
    province,
    hunza,
    skardu,
    attraction,
    experience,
    restaurant,
  ];
  await graphTransaction(db, async (repo, tx) => {
    const service = new KnowledgeGraphService(repo);
    const geo = [
      {
        id: country,
        name: 'Pakistan',
        slug: `pakistan-${suffix}`,
        type: 'COUNTRY' as const,
      },
      {
        id: region,
        name: 'Northern Pakistan',
        slug: regionSlug,
        type: 'REGION' as const,
        parentId: country,
      },
      {
        id: province,
        name: 'Gilgit-Baltistan',
        slug: provinceSlug,
        type: 'PROVINCE_TERRITORY' as const,
        parentId: region,
      },
      {
        id: hunza,
        name: 'Hunza',
        slug: hunzaSlug,
        type: 'DESTINATION' as const,
        parentId: province,
        coordinates: { latitude: 36.3167, longitude: 74.65 },
      },
      {
        id: skardu,
        name: 'Skardu',
        slug: skarduSlug,
        type: 'CITY' as const,
        parentId: province,
        coordinates: { latitude: 35.2971, longitude: 75.6333 },
      },
    ];
    for (const g of geo) {
      await service.createGeo({ ...g, primarySourceId: source.id });
      if (g.parentId)
        await repo.createRelation({
          sourceId: g.id,
          sourceKind: 'GEO_ENTITY',
          targetId: g.parentId,
          targetKind: 'GEO_ENTITY',
          type: 'PART_OF',
          sourceRecordId: source.id,
        });
    }
    for (const p of [
      {
        id: attraction,
        name: 'Attabad Lake (test)',
        type: 'ATTRACTION' as const,
      },
      {
        id: restaurant,
        name: 'Synthetic local kitchen',
        type: 'RESTAURANT' as const,
      },
      {
        id: draftAttraction,
        name: 'Private draft attraction',
        type: 'ATTRACTION' as const,
      },
    ])
      await service.createPlace({
        ...p,
        slug: `place-${p.id}`,
        geoEntityId: hunza,
        primarySourceId: source.id,
      });
    await service.createExperience({
      id: experience,
      name: 'Lake boating (test)',
      slug: `experience-${experience}`,
      category: 'boating',
      geoEntityId: hunza,
      primarySourceId: source.id,
    });
    await tx.entityRegistry.updateMany({
      where: { id: { in: canonicalIds } },
      data: { status: 'PUBLISHED', lastVerified: time },
    });
    for (const e of [
      {
        sourceId: hunza,
        sourceKind: 'GEO_ENTITY' as const,
        targetId: attraction,
        targetKind: 'PLACE' as const,
        type: 'HAS_ATTRACTION' as const,
      },
      {
        sourceId: attraction,
        sourceKind: 'PLACE' as const,
        targetId: experience,
        targetKind: 'EXPERIENCE' as const,
        type: 'HAS_EXPERIENCE' as const,
      },
      {
        sourceId: hunza,
        sourceKind: 'GEO_ENTITY' as const,
        targetId: draftAttraction,
        targetKind: 'PLACE' as const,
        type: 'HAS_ATTRACTION' as const,
      },
    ])
      await tx.entityRelation.create({
        data: {
          ...e,
          sourceRecordId: source.id,
          status: 'PUBLISHED',
          lastVerified: time,
        },
      });
    await tx.destinationProfile.createMany({
      data: [
        {
          id: hunza,
          interests: ['nature', 'photography'],
          seasons: ['summer'],
          sourceId: source.id,
          status: 'PUBLISHED',
          lastVerified: time,
        },
        {
          id: skardu,
          interests: ['nature', 'heritage'],
          seasons: ['all-year'],
          sourceId: source.id,
          status: 'PUBLISHED',
          lastVerified: time,
        },
      ],
    });
  });
  async function actor(role: 'CONTRIBUTOR' | 'EDITOR'): Promise<CmsActor> {
    const s = await db.staffAccount.create({
      data: {
        email: `destination-${role.toLowerCase()}-${suffix}@visitspakistan.test`,
        displayName: `Destination test ${role.toLowerCase()}`,
        roles: [role],
        passwordHash: 'not-a-login-account',
        mfaSecret: 'not-an-enrolled-account',
      },
    });
    return { id: s.id, displayName: s.displayName, roles: s.roles };
  }
  const author = await actor('CONTRIBUTOR'),
    editor = await actor('EDITOR');
  const media = new MediaStore(db, mediaRoot);
  const png = await sharp(
    await readFile(resolve('apps/cms/public/hunza-illustration.svg')),
  )
    .png()
    .toBuffer();
  const hero = await media.upload(
    author,
    png,
    'Original illustrative mountain landscape, used by isolated tests',
    'VisitsPakistan original illustration · synthetic test content',
  );
  const template = await db.siteTemplate.create({
    data: {
      name: 'Destination test editorial',
      slug: `destination-test-${suffix}`,
      layout: 'EDITORIAL',
      allowedBlocks: [...blockTypes],
    },
  });
  const assignments = await db.templateAssignment.findMany({
    where: {
      type: {
        in: [
          'DESTINATION_EDITORIAL',
          'FOOD_GUIDE',
          'ROUTE_GUIDE',
          'ITINERARY_EDITORIAL',
        ],
      },
    },
  });
  for (const type of [
    'DESTINATION_EDITORIAL',
    'FOOD_GUIDE',
    'ROUTE_GUIDE',
    'ITINERARY_EDITORIAL',
  ] as const)
    await db.templateAssignment.upsert({
      where: { type },
      create: { type, templateId: template.id },
      update: { templateId: template.id },
    });
  const store = new EditorialStore(db);
  const docs: Array<{ id: string; version: number }> = [];
  async function editorial(
    destination: string,
    type:
      | 'DESTINATION_EDITORIAL'
      | 'FOOD_GUIDE'
      | 'ROUTE_GUIDE'
      | 'ITINERARY_EDITORIAL',
    title: string,
  ) {
    let doc = await store.create(author, {
      type,
      slug: `editorial-${randomUUID()}`,
      locale: 'en',
      primaryEntityId: destination,
      body: {
        title,
        summary:
          'An isolated test editorial about landscapes and curiosity, with no unverified access or commercial claims.',
        seoTitle: `${title} | VisitsPakistan`,
        metaDescription:
          'Explore this synthetic destination editorial and its linked canonical places. Used exclusively to verify the destination vertical in an isolated test database.',
        blocks: [
          { type: 'heading', level: 2, text: 'A different perspective' },
          {
            type: 'paragraph',
            text: 'Follow your curiosity. This synthetic story demonstrates published editorial presentation, not verified travel recommendations.',
          },
        ],
        sourceIds: [source.id],
        canonicalIds: [destination],
        heroMediaId: hero.id,
        lastVerified: time.toISOString(),
      },
    });
    doc = await store.action(author, doc.id, {
      action: 'submit',
      expectedVersion: doc.version,
    });
    doc = await store.action(editor, doc.id, {
      action: 'approve',
      expectedVersion: doc.version,
    });
    doc = await store.action(editor, doc.id, {
      action: 'publish',
      expectedVersion: doc.version,
    });
    docs.push(doc);
    return doc;
  }
  const hunzaEditorial = await editorial(
    hunza,
    'DESTINATION_EDITORIAL',
    'Hunza, a different pace',
  );
  const skarduEditorial = await editorial(
    skardu,
    'DESTINATION_EDITORIAL',
    'Skardu, stories in the landscape',
  );
  const foodGuide = await editorial(
    hunza,
    'FOOD_GUIDE',
    'Hunza food reading list',
  );
  const routeGuide = await editorial(
    hunza,
    'ROUTE_GUIDE',
    'Hunza route reading list',
  );
  const itineraryGuide = await editorial(
    hunza,
    'ITINERARY_EDITORIAL',
    'Hunza itinerary reading list',
  );
  return {
    source,
    hero,
    author,
    editor,
    hunza,
    skardu,
    region,
    province,
    attraction,
    experience,
    restaurant,
    draftAttraction,
    hunzaSlug,
    skarduSlug,
    regionSlug,
    provinceSlug,
    hunzaEditorial,
    skarduEditorial,
    foodGuide,
    routeGuide,
    itineraryGuide,
    time,
    store,
    async cleanup() {
      for (const doc of docs)
        await db.editorialDocument.update({
          where: { id: doc.id },
          data: { publishedRevisionId: null },
        });
      await db.entityRegistry.updateMany({
        where: {
          id: {
            in: [...canonicalIds, draftAttraction, ...docs.map((d) => d.id)],
          },
        },
        data: { status: 'WITHDRAWN', deletedAt: new Date() },
      });
      await db.destinationProfile.updateMany({
        where: { id: { in: [hunza, skardu] } },
        data: { status: 'WITHDRAWN', deletedAt: new Date() },
      });
      await db.sourceRecord.update({
        where: { id: source.id },
        data: { retiredAt: new Date() },
      });
      await db.staffAccount.updateMany({
        where: { id: { in: [author.id, editor.id] } },
        data: { active: false },
      });
      for (const type of [
        'DESTINATION_EDITORIAL',
        'FOOD_GUIDE',
        'ROUTE_GUIDE',
        'ITINERARY_EDITORIAL',
      ] as const) {
        const prior = assignments.find((a) => a.type === type);
        if (prior)
          await db.templateAssignment.update({
            where: { type },
            data: { templateId: prior.templateId },
          });
        else await db.templateAssignment.delete({ where: { type } });
      }
    },
  };
}
