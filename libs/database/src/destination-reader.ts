import {
  destinationQuerySchema,
  attractionTypes,
  destinationPresentationSchema,
  EditorialError,
  type DestinationQuery,
  type DestinationDirectory,
  type DestinationCard,
  type DestinationDetail,
  type DestinationEditorial,
  type PublicEntity,
  type PublicSource,
} from '@visitspakistan/domain';
import { Prisma, type PrismaClient } from './generated/client';
import { EditorialStore } from './editorial-store';
const activeSource = Prisma.sql`s.retired_at IS NULL AND s.source_type <> 'DEVELOPMENT_FIXTURE'`;
const eligible = Prisma.sql`WITH RECURSIVE eligible AS (
 SELECT p.id, p.interests, p.seasons, e.name, e.slug, e.locale FROM destination_profile p
 JOIN entity_registry e ON e.id=p.id JOIN source_record s ON s.id=e.primary_source_id
 JOIN source_record ps ON ps.id=p.source_id
 WHERE p.status='PUBLISHED' AND p.deleted_at IS NULL AND p.last_verified IS NOT NULL
 AND e.status='PUBLISHED' AND e.deleted_at IS NULL AND e.last_verified IS NOT NULL
 AND ${activeSource} AND ps.retired_at IS NULL AND ps.source_type<>'DEVELOPMENT_FIXTURE'
), ancestors AS (
 SELECT p.id AS destination_id, g.parent_id AS ancestor_id, 0 AS depth FROM eligible p JOIN geo_entity g ON g.id=p.id WHERE g.parent_id IS NOT NULL
 UNION ALL SELECT a.destination_id,g.parent_id,a.depth+1 FROM ancestors a JOIN geo_entity g ON g.id=a.ancestor_id WHERE g.parent_id IS NOT NULL
)`;
type Source = {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  accessedAt: Date;
};
const sourceDTO = (s: Source): PublicSource => ({
  id: s.id,
  title: s.title,
  publisher: s.publisher,
  url: s.url,
  accessed_at: s.accessedAt.toISOString(),
});
const sourceSelect = {
  id: true,
  title: true,
  publisher: true,
  url: true,
  accessedAt: true,
} as const;
const publicEntity = (e: {
  id: string;
  kind: string;
  name: string;
  slug: string;
  lastVerified: Date | null;
  primarySource: Source | null;
}): PublicEntity => ({
  id: e.id,
  kind: e.kind,
  name: e.name,
  slug: e.slug,
  last_verified: e.lastVerified!.toISOString(),
  sources: e.primarySource ? [sourceDTO(e.primarySource)] : [],
});
const publicWhere = {
  status: 'PUBLISHED',
  deletedAt: null,
  lastVerified: { not: null },
  primarySource: {
    retiredAt: null,
    sourceType: { not: 'DEVELOPMENT_FIXTURE' },
  },
} as const;
const publicConceptWhere = {
  ...publicWhere,
  OR: [
    { kind: 'PLACE', place: { geoEntity: { entity: publicWhere } } },
    {
      kind: 'EXPERIENCE',
      experience: {
        OR: [{ geoEntityId: null }, { geoEntity: { entity: publicWhere } }],
      },
    },
  ],
} satisfies Prisma.EntityRegistryWhereInput;
export class DestinationReader {
  private readonly content: EditorialStore;
  constructor(private readonly db: PrismaClient) {
    this.content = new EditorialStore(db);
  }
  async directory(input: unknown): Promise<DestinationDirectory> {
    const q = destinationQuerySchema.parse(input);
    return this.db.$transaction(
      async (tx) => {
        const predicate = this.filter(q);
        const [count, ids, facets] = await Promise.all([
          tx.$queryRaw<Array<{ total: number }>>(
            Prisma.sql`${eligible} SELECT count(*)::int AS total FROM eligible p WHERE ${predicate}`,
          ),
          tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`${eligible} SELECT p.id FROM eligible p WHERE ${predicate} ORDER BY p.name COLLATE "C",p.id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
          ),
          this.facets(tx, q.locale),
        ]);
        const data = await Promise.all(ids.map(({ id }) => this.card(tx, id)));
        const total = count[0]!.total;
        return {
          data,
          pagination: {
            page: q.page,
            pageSize: q.pageSize,
            total,
            totalPages: Math.ceil(total / q.pageSize),
          },
          facets,
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }
  private filter(q: DestinationQuery) {
    return Prisma.sql`p.locale=${q.locale}
   ${q.interest ? Prisma.sql`AND p.interests @> ARRAY[${q.interest}]::text[]` : Prisma.empty}
   ${q.season ? Prisma.sql`AND (p.seasons @> ARRAY[${q.season}]::text[] ${q.season !== 'all-year' ? Prisma.sql`OR p.seasons @> ARRAY['all-year']::text[]` : Prisma.empty})` : Prisma.empty}
   ${q.region ? Prisma.sql`AND EXISTS (SELECT 1 FROM ancestors a JOIN geo_entity g ON g.id=a.ancestor_id JOIN entity_registry e ON e.id=g.id JOIN source_record s ON s.id=e.primary_source_id WHERE a.destination_id=p.id AND g.type IN ('REGION','PROVINCE_TERRITORY') AND e.slug=${q.region} AND e.locale=${q.locale} AND e.status='PUBLISHED' AND e.deleted_at IS NULL AND e.last_verified IS NOT NULL AND ${activeSource})` : Prisma.empty}`;
  }
  private async facets(tx: Prisma.TransactionClient, locale: string) {
    const rows = await tx.$queryRaw<
      Array<{ kind: string; slug: string; name: string }>
    >(Prisma.sql`${eligible}
   SELECT 'region' AS kind,e.slug,e.name FROM ancestors a JOIN eligible p ON p.id=a.destination_id JOIN geo_entity g ON g.id=a.ancestor_id JOIN entity_registry e ON e.id=g.id JOIN source_record s ON s.id=e.primary_source_id WHERE p.locale=${locale} AND e.locale=${locale} AND g.type IN ('REGION','PROVINCE_TERRITORY') AND e.status='PUBLISHED' AND e.deleted_at IS NULL AND e.last_verified IS NOT NULL AND ${activeSource} GROUP BY e.slug,e.name
   UNION SELECT 'interest',tag,tag FROM eligible p CROSS JOIN LATERAL unnest(p.interests) tag WHERE p.locale=${locale}
   UNION SELECT 'season',tag,tag FROM eligible p CROSS JOIN LATERAL unnest(p.seasons) tag WHERE p.locale=${locale}
   ORDER BY kind,name`);
    return {
      regions: rows
        .filter((r) => r.kind === 'region')
        .map((r) => ({ slug: r.slug, name: r.name })),
      interests: rows.filter((r) => r.kind === 'interest').map((r) => r.slug),
      seasons: rows.filter((r) => r.kind === 'season').map((r) => r.slug),
    };
  }
  private async editorial(
    tx: Prisma.TransactionClient,
    id: string,
    locale: string,
  ) {
    const candidates = await tx.contentItem.findMany({
      where: {
        primaryEntityId: id,
        entity: { locale, ...publicWhere },
        editorial: { publishedRevisionId: { not: null } },
      },
      select: { type: true, entity: { select: { slug: true } } },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take: 50,
    });
    const published = [];
    for (const c of candidates) {
      try {
        const r = await this.content.getPublished(c.entity.slug, locale, tx);
        const dto: DestinationEditorial = {
          id: r.id,
          type: r.type,
          slug: r.slug,
          locale: r.locale,
          title: r.title,
          summary: r.summary,
          seoTitle: r.seoTitle,
          metaDescription: r.metaDescription,
          destination: r.destination
            ? destinationPresentationSchema.parse(r.destination)
            : null,
          blocks: r.blocks as unknown as DestinationEditorial['blocks'],
          author: r.author,
          reviewer: r.reviewer,
          firstPublished: r.firstPublished?.toISOString() ?? null,
          lastUpdated: r.lastUpdated.toISOString(),
          lastVerified: r.lastVerified?.toISOString() ?? null,
          heroMedia: r.heroMedia ?? null,
          media: r.media,
          sources: r.sources.map((s) => ({
            id: s.id,
            title: s.title,
            publisher: s.publisher,
            url: s.url,
            accessed_at: s.accessedAt.toISOString(),
          })),
          canonicalEntities: r.canonicalEntities,
        };
        published.push(dto);
      } catch (e) {
        if (!(e instanceof EditorialError && e.status === 404)) throw e;
      }
    }
    return published;
  }
  private async card(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<DestinationCard> {
    const p = await tx.destinationProfile.findUniqueOrThrow({
      where: { id },
      include: {
        source: { select: sourceSelect },
        geography: {
          include: {
            entity: { include: { primarySource: { select: sourceSelect } } },
          },
        },
      },
    });
    const e = p.geography.entity;
    const [coordinates, ancestors, content] = await Promise.all([
      tx.$queryRaw<
        Array<{ coordinates: DestinationCard['canonical']['coordinates'] }>
      >`SELECT CASE WHEN location IS NULL THEN NULL ELSE json_build_object('latitude',ST_Y(location::geometry),'longitude',ST_X(location::geometry)) END AS coordinates FROM geo_entity WHERE id=${id}::uuid`,
      tx.$queryRaw<
        Array<{
          id: string;
          kind: string;
          name: string;
          slug: string;
          lastVerified: Date;
          type: string;
          source: PublicSource;
        }>
      >(
        Prisma.sql`${eligible} SELECT e.id,e.kind,e.name,e.slug,e.last_verified AS "lastVerified",g.type,json_build_object('id',s.id,'title',s.title,'publisher',s.publisher,'url',s.url,'accessed_at',s.accessed_at) AS source FROM ancestors a JOIN geo_entity g ON g.id=a.ancestor_id JOIN entity_registry e ON e.id=g.id JOIN source_record s ON s.id=e.primary_source_id WHERE a.destination_id=${id}::uuid AND e.locale=${e.locale} AND e.status='PUBLISHED' AND e.deleted_at IS NULL AND e.last_verified IS NOT NULL AND ${activeSource} ORDER BY a.depth DESC`,
      ),
      this.editorial(tx, id, e.locale),
    ]);
    const hierarchy = ancestors.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      slug: a.slug,
      last_verified: a.lastVerified.toISOString(),
      sources: [a.source],
    }));
    const region = [...ancestors]
      .reverse()
      .find((a) => ['REGION', 'PROVINCE_TERRITORY'].includes(a.type));
    return {
      canonical: {
        ...publicEntity(e),
        type: p.geography.type as 'CITY' | 'DESTINATION',
        locale: e.locale,
        timezone: p.geography.timezone,
        alt_names: p.geography.altNames,
        parent_id: p.geography.parentId,
        summary: p.geography.summary,
        status: 'PUBLISHED',
        created_at: e.createdAt.toISOString(),
        updated_at: e.updatedAt.toISOString(),
        latitude: coordinates[0]?.coordinates?.latitude ?? null,
        longitude: coordinates[0]?.coordinates?.longitude ?? null,
        geometry: coordinates[0]?.coordinates
          ? {
              type: 'Point',
              coordinates: [
                coordinates[0].coordinates.longitude,
                coordinates[0].coordinates.latitude,
              ],
            }
          : null,
        coordinates: coordinates[0]?.coordinates ?? null,
      },
      interests: p.interests,
      seasons: p.seasons,
      region: region ? hierarchy.find((h) => h.id === region.id)! : null,
      hierarchy,
      editorial:
        content.find((c) => c.type === 'DESTINATION_EDITORIAL') ?? null,
      sources: [
        ...new Map(
          [...publicEntity(e).sources, sourceDTO(p.source)].map((s) => [
            s.id,
            s,
          ]),
        ).values(),
      ],
      last_verified: new Date(
        Math.min(e.lastVerified!.getTime(), p.lastVerified!.getTime()),
      ).toISOString(),
    };
  }
  async detail(slug: string, locale = 'en'): Promise<DestinationDetail> {
    return this.db.$transaction(
      async (tx) => {
        const ids = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`${eligible} SELECT id FROM eligible WHERE slug=${slug} AND locale=${locale}`,
        );
        if (!ids[0]) throw new EditorialError(404, 'Destination not found');
        const id = ids[0].id;
        const card = await this.card(tx, id);
        const geo = await tx.geoEntity.findUniqueOrThrow({
          where: { id },
          select: { parentId: true },
        });
        const [parent, children, siblings] = await Promise.all([
          geo.parentId
            ? tx.geoEntity.findFirst({
                where: { id: geo.parentId, entity: { locale, ...publicWhere } },
                include: {
                  entity: {
                    include: { primarySource: { select: sourceSelect } },
                  },
                },
              })
            : null,
          tx.geoEntity.findMany({
            where: { parentId: id, entity: { locale, ...publicWhere } },
            include: {
              entity: { include: { primarySource: { select: sourceSelect } } },
            },
            orderBy: [{ entity: { name: 'asc' } }, { id: 'asc' }],
            take: 48,
          }),
          geo.parentId
            ? tx.$queryRaw<Array<{ id: string }>>(
                Prisma.sql`${eligible} SELECT p.id FROM eligible p JOIN geo_entity g ON g.id=p.id WHERE g.parent_id=${geo.parentId}::uuid AND p.id<>${id}::uuid AND p.locale=${locale} ORDER BY p.name COLLATE "C",p.id LIMIT 6`,
              )
            : [],
        ]);
        const geographyIds = [
          ...children.map((g) => g.id),
          ...(parent ? [parent.id] : []),
        ];
        const linked = geographyIds.length
          ? await tx.$queryRaw<Array<{ id: string; slug: string }>>(
              Prisma.sql`${eligible} SELECT id,slug FROM eligible WHERE id IN (${Prisma.join(geographyIds.map((v) => Prisma.sql`${v}::uuid`))}) AND locale=${locale}`,
            )
          : [];
        const geographyDTO = (g: NonNullable<typeof parent>) => ({
          ...publicEntity(g.entity),
          type: g.type,
          summary: g.summary,
          destination_slug: linked.find((d) => d.id === g.id)?.slug ?? null,
        });
        const related = await Promise.all(
          siblings.map((s) => this.card(tx, s.id)),
        );
        const edges = await tx.entityRelation.findMany({
          where: {
            sourceId: id,
            type: { in: ['HAS_ATTRACTION', 'HAS_EXPERIENCE'] },
            status: 'PUBLISHED',
            deletedAt: null,
            lastVerified: { not: null },
            sourceRecord: {
              retiredAt: null,
              sourceType: { not: 'DEVELOPMENT_FIXTURE' },
            },
            target: { locale, ...publicConceptWhere },
          },
          include: {
            target: {
              include: {
                primarySource: { select: sourceSelect },
                place: { select: { type: true } },
              },
            },
          },
          orderBy: [{ target: { name: 'asc' } }, { id: 'asc' }],
          take: 100,
        });
        const attractions = edges
          .filter(
            (r) =>
              r.type === 'HAS_ATTRACTION' &&
              !!r.target.place &&
              attractionTypes.includes(r.target.place.type),
          )
          .map((r) => publicEntity(r.target));
        const nested = await tx.entityRelation.findMany({
          where: {
            sourceId: { in: attractions.map((a) => a.id) },
            type: 'HAS_EXPERIENCE',
            status: 'PUBLISHED',
            deletedAt: null,
            lastVerified: { not: null },
            sourceRecord: {
              retiredAt: null,
              sourceType: { not: 'DEVELOPMENT_FIXTURE' },
            },
            target: { locale, ...publicConceptWhere },
          },
          include: {
            target: { include: { primarySource: { select: sourceSelect } } },
          },
          orderBy: [{ target: { name: 'asc' } }, { id: 'asc' }],
          take: 100,
        });
        const experiences = [
          ...new Map(
            [
              ...edges.filter((r) => r.type === 'HAS_EXPERIENCE'),
              ...nested,
            ].map((r) => [r.target.id, publicEntity(r.target)]),
          ).values(),
        ];
        const restaurants = await tx.place.findMany({
          where: {
            geoEntityId: id,
            type: 'RESTAURANT',
            entity: { locale, ...publicWhere },
          },
          include: {
            entity: { include: { primarySource: { select: sourceSelect } } },
          },
          orderBy: [{ entity: { name: 'asc' } }, { id: 'asc' }],
          take: 100,
        });
        const content = await this.editorial(tx, id, locale);
        return {
          ...card,
          geographic_parent: parent ? geographyDTO(parent) : null,
          geographic_children: children.map(geographyDTO),
          related_destinations: related,
          sources: [
            ...new Map(
              [
                ...card.sources,
                ...(parent ? publicEntity(parent.entity).sources : []),
                ...children.flatMap((g) => publicEntity(g.entity).sources),
                ...attractions.flatMap((a) => a.sources),
                ...experiences.flatMap((a) => a.sources),
                ...restaurants.flatMap((p) => publicEntity(p.entity).sources),
                ...content.flatMap((c) => c.sources),
              ].map((s) => [s.id, s]),
            ).values(),
          ],
          attractions,
          experiences,
          food: restaurants.map((p) => publicEntity(p.entity)),
          routes: [],
          itineraries: [],
          travel_products: [],
          guides: content
            .filter((c) => c.type !== 'DESTINATION_EDITORIAL')
            .map((c) => ({
              id: c.id,
              type: c.type,
              title: c.title,
              slug: c.slug,
              summary: c.summary,
            })),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }
}
