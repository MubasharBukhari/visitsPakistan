import {
  thingsQuerySchema,
  EditorialError,
  type ThingsQuery,
  type ThingsDirectory,
  type DiscoveryCard,
  type DiscoveryDetail,
  type DiscoveryLink,
} from '@visitspakistan/domain';
import { Prisma, type PrismaClient } from './generated/client';
import { EditorialStore } from './editorial-store';
import { publishedEditorial } from './public-editorial';
export const discoveryPublicCte = Prisma.sql`WITH public_entities AS (
 SELECT e.* FROM entity_registry e JOIN source_record s ON s.id=e.primary_source_id WHERE e.status='PUBLISHED' AND e.deleted_at IS NULL AND e.last_verified IS NOT NULL AND s.retired_at IS NULL AND s.source_type<>'DEVELOPMENT_FIXTURE'
), geography AS (SELECT g.* FROM geo_entity g JOIN public_entities e ON e.id=g.id), destinations AS (
 SELECT e.* FROM destination_profile p JOIN public_entities e ON e.id=p.id JOIN source_record s ON s.id=p.source_id WHERE p.status='PUBLISHED' AND p.deleted_at IS NULL AND p.last_verified IS NOT NULL AND s.retired_at IS NULL AND s.source_type<>'DEVELOPMENT_FIXTURE'
), nodes AS (
 SELECT e.id,e.kind,e.name,e.slug,e.locale,lower(replace(replace(p.category,'_','-'),' ','-')) AS category,p.seasons,p.family_suitable,p.duration_minutes FROM public_entities e JOIN place p ON p.id=e.id JOIN geography g ON g.id=p.geo_entity_id WHERE p.type IN ('ATTRACTION','LANDMARK','NATURAL_ATTRACTION')
 UNION ALL SELECT e.id,e.kind,e.name,e.slug,e.locale,lower(replace(replace(x.category,'_','-'),' ','-')),x.seasons,x.family_suitable,x.duration_minutes FROM public_entities e JOIN experience x ON x.id=e.id WHERE x.geo_entity_id IS NULL OR EXISTS (SELECT 1 FROM geography g WHERE g.id=x.geo_entity_id)
), edges AS (
 SELECT r.* FROM entity_relation r JOIN source_record s ON s.id=r.source_record_id JOIN public_entities a ON a.id=r.source_id JOIN public_entities b ON b.id=r.target_id WHERE r.status='PUBLISHED' AND r.deleted_at IS NULL AND r.last_verified IS NOT NULL AND s.retired_at IS NULL AND s.source_type<>'DEVELOPMENT_FIXTURE'
), associations AS (
 SELECT d.id AS destination_id,n.id AS node_id FROM destinations d JOIN edges r ON r.source_id=d.id JOIN nodes n ON n.id=r.target_id WHERE (r.type='HAS_ATTRACTION' AND n.kind='PLACE') OR (r.type='HAS_EXPERIENCE' AND n.kind='EXPERIENCE')
 UNION SELECT d.id,x.id FROM destinations d JOIN edges a ON a.source_id=d.id AND a.type='HAS_ATTRACTION' JOIN nodes p ON p.id=a.target_id AND p.kind='PLACE' JOIN edges b ON b.source_id=p.id AND b.type='HAS_EXPERIENCE' JOIN nodes x ON x.id=b.target_id AND x.kind='EXPERIENCE'
)`;
const cte = discoveryPublicCte;
const sourceSelect = {
  id: true,
  title: true,
  publisher: true,
  url: true,
  accessedAt: true,
} as const;
type Row = {
  id: string;
  kind: string;
  name: string;
  slug: string;
  locale: string;
  lastVerified: Date;
  source: DiscoveryLink['sources'][number];
};
const link = (r: Row): DiscoveryLink => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  slug: r.slug,
  locale: r.locale,
  last_verified: r.lastVerified.toISOString(),
  sources: [r.source],
});
const projection = Prisma.sql`e.id,e.kind,e.name,e.slug,e.locale,e.last_verified AS "lastVerified",json_build_object('id',s.id,'title',s.title,'publisher',s.publisher,'url',s.url,'accessed_at',s.accessed_at) AS source`;
export class DiscoveryReader {
  private readonly content: EditorialStore;
  constructor(private readonly db: PrismaClient) {
    this.content = new EditorialStore(db);
  }
  private filter(q: ThingsQuery) {
    return Prisma.sql`n.locale=${q.locale}
    ${q.kind ? Prisma.sql`AND n.kind::text=${q.kind === 'place' ? 'PLACE' : 'EXPERIENCE'}` : Prisma.empty}
    ${q.category ? Prisma.sql`AND n.category=${q.category}` : Prisma.empty}
    ${q.familySuitable !== undefined ? Prisma.sql`AND n.family_suitable=${q.familySuitable}` : Prisma.empty}
    ${q.duration ? Prisma.sql`AND n.duration_minutes<=${q.duration}` : Prisma.empty}
    ${q.season ? Prisma.sql`AND (n.seasons @> ARRAY[${q.season}]::text[] ${q.season !== 'all-year' ? Prisma.sql`OR n.seasons @> ARRAY['all-year']::text[]` : Prisma.empty})` : Prisma.empty}
    ${q.destination ? Prisma.sql`AND EXISTS (SELECT 1 FROM associations a JOIN destinations d ON d.id=a.destination_id WHERE a.node_id=n.id AND d.slug=${q.destination} AND d.locale=${q.locale})` : Prisma.empty}`;
  }
  async directory(input: unknown): Promise<ThingsDirectory> {
    const q = thingsQuerySchema.parse(input);
    return this.db.$transaction(
      async (tx) => {
        const [count, ids, facets] = await Promise.all([
          tx.$queryRaw<Array<{ total: number }>>(
            Prisma.sql`${cte} SELECT count(*)::int AS total FROM nodes n WHERE ${this.filter(q)}`,
          ),
          tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`${cte} SELECT n.id FROM nodes n WHERE ${this.filter(q)} ORDER BY n.name COLLATE "C",n.id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
          ),
          tx.$queryRaw<
            Array<{ kind: string; slug: string; name: string }>
          >(Prisma.sql`${cte} SELECT DISTINCT 'destination' AS kind,d.slug,d.name FROM associations a JOIN destinations d ON d.id=a.destination_id JOIN nodes n ON n.id=a.node_id WHERE d.locale=${q.locale} AND n.locale=${q.locale}
        UNION SELECT 'category',n.category,n.category FROM nodes n WHERE n.locale=${q.locale} AND n.category IS NOT NULL
        UNION SELECT 'season',tag,tag FROM nodes n CROSS JOIN LATERAL unnest(n.seasons) tag WHERE n.locale=${q.locale} ORDER BY kind,name`),
        ]);
        const total = count[0]!.total;
        return {
          data: await Promise.all(ids.map((r) => this.card(tx, r.id))),
          pagination: {
            page: q.page,
            pageSize: q.pageSize,
            total,
            totalPages: Math.ceil(total / q.pageSize),
          },
          facets: {
            destinations: facets
              .filter((f) => f.kind === 'destination')
              .map((f) => ({ slug: f.slug, name: f.name })),
            categories: facets
              .filter((f) => f.kind === 'category')
              .map((f) => f.slug),
            seasons: facets
              .filter((f) => f.kind === 'season')
              .map((f) => f.slug),
          },
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }
  private async destinationLinks(
    tx: Prisma.TransactionClient,
    id: string,
    locale: string,
  ) {
    const rows = await tx.$queryRaw<Row[]>(
      Prisma.sql`${cte} SELECT ${projection} FROM associations a JOIN destinations e ON e.id=a.destination_id JOIN source_record s ON s.id=e.primary_source_id WHERE a.node_id=${id}::uuid AND e.locale=${locale} ORDER BY e.name,e.id LIMIT 48`,
    );
    return rows.map(link);
  }
  private async card(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<DiscoveryCard> {
    const e = await tx.entityRegistry.findUniqueOrThrow({
      where: { id },
      include: {
        place: true,
        experience: true,
        primarySource: { select: sourceSelect },
      },
    });
    const p = e.place,
      x = e.experience;
    const facts = p ?? x!;
    const [coordinates, editorial, destinations] = await Promise.all([
      p
        ? tx.$queryRaw<
            Array<{ latitude: number; longitude: number }>
          >`SELECT ST_Y(location::geometry) AS latitude,ST_X(location::geometry) AS longitude FROM place WHERE id=${id}::uuid AND location IS NOT NULL`
        : [],
      publishedEditorial(
        this.content,
        tx,
        id,
        p ? 'ATTRACTION_EDITORIAL' : 'EXPERIENCE_EDITORIAL',
        e.locale,
      ),
      this.destinationLinks(tx, id, e.locale),
    ]);
    const s = e.primarySource!;
    const sources = [
      {
        id: s.id,
        title: s.title,
        publisher: s.publisher,
        url: s.url,
        accessed_at: s.accessedAt.toISOString(),
      },
      ...(editorial?.sources ?? []),
    ];
    return {
      canonical: {
        id: e.id,
        kind: p ? 'PLACE' : 'EXPERIENCE',
        name: e.name,
        slug: e.slug,
        locale: e.locale,
        last_verified: e.lastVerified!.toISOString(),
        sources: [sources[0]!],
        place_type: p?.type ?? null,
        geo_entity_id: facts.geoEntityId,
        alt_names: facts.altNames,
        summary: facts.summary,
        category:
          facts.category
            ?.toLowerCase()
            .replaceAll('_', '-')
            .replaceAll(' ', '-') ?? null,
        coordinates: coordinates[0] ?? null,
        opening_information: p?.openingInformation ?? null,
        admission_information: p?.admissionInformation ?? null,
        duration_minutes: facts.durationMinutes,
        best_time: p?.bestTime ?? null,
        seasons: facts.seasons,
        family_suitable: facts.familySuitable,
        accessibility: p?.accessibility ?? null,
        facilities: p?.facilities ?? [],
        difficulty: x?.difficulty ?? null,
        status: 'PUBLISHED',
        created_at: e.createdAt.toISOString(),
        updated_at: e.updatedAt.toISOString(),
      },
      editorial,
      destinations,
      sources: [...new Map(sources.map((s) => [s.id, s])).values()],
      last_verified: e.lastVerified!.toISOString(),
    };
  }
  async detail(
    kind: 'PLACE' | 'EXPERIENCE',
    slug: string,
    locale = 'en',
  ): Promise<DiscoveryDetail> {
    return this.db.$transaction(
      async (tx) => {
        const found = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`${cte} SELECT id FROM nodes WHERE kind::text=${kind} AND slug=${slug} AND locale=${locale}`,
        );
        if (!found[0])
          throw new EditorialError(404, 'Discovery entity not found');
        const id = found[0].id,
          card = await this.card(tx, id);
        const [related, nearby, geography, edgeSources] = await Promise.all([
          tx.$queryRaw<Array<Row & { relation: string }>>(
            Prisma.sql`${cte} SELECT ${projection},CASE WHEN r.source_id=${id}::uuid THEN 'experience' ELSE 'place' END AS relation FROM edges r JOIN nodes n ON n.id=CASE WHEN r.source_id=${id}::uuid THEN r.target_id ELSE r.source_id END JOIN public_entities e ON e.id=n.id JOIN source_record s ON s.id=e.primary_source_id WHERE r.type='HAS_EXPERIENCE' AND (r.source_id=${id}::uuid OR r.target_id=${id}::uuid) AND n.locale=${locale} ORDER BY e.name,e.id LIMIT 100`,
          ),
          kind === 'PLACE'
            ? tx.$queryRaw<Array<Row & { distance_meters: number | null }>>(
                Prisma.sql`${cte} SELECT ${projection},ST_Distance(a.location,b.location) AS distance_meters FROM edges r JOIN nodes n ON n.id=CASE WHEN r.source_id=${id}::uuid THEN r.target_id ELSE r.source_id END JOIN public_entities e ON e.id=n.id JOIN source_record s ON s.id=e.primary_source_id JOIN place a ON a.id=${id}::uuid JOIN place b ON b.id=n.id WHERE r.type='NEAR' AND (r.source_id=${id}::uuid OR r.target_id=${id}::uuid) AND n.kind='PLACE' AND n.locale=${locale} ORDER BY e.name,e.id LIMIT 48`,
              )
            : [],
          card.canonical.geo_entity_id
            ? tx.$queryRaw<Row[]>(
                Prisma.sql`${cte} SELECT ${projection} FROM geography g JOIN public_entities e ON e.id=g.id JOIN source_record s ON s.id=e.primary_source_id WHERE g.id=${card.canonical.geo_entity_id}::uuid AND e.locale=${locale}`,
              )
            : [],
          tx.$queryRaw<Array<DiscoveryLink['sources'][number]>>(
            Prisma.sql`${cte} SELECT DISTINCT s.id,s.title,s.publisher,s.url,s.accessed_at::text AS accessed_at FROM edges r JOIN source_record s ON s.id=r.source_record_id WHERE (r.source_id=${id}::uuid OR r.target_id=${id}::uuid) AND (EXISTS (SELECT 1 FROM nodes n WHERE n.id=CASE WHEN r.source_id=${id}::uuid THEN r.target_id ELSE r.source_id END AND n.locale=${locale}) OR EXISTS (SELECT 1 FROM destinations d WHERE d.id=CASE WHEN r.source_id=${id}::uuid THEN r.target_id ELSE r.source_id END AND d.locale=${locale}))`,
          ),
        ]);
        const places = related
            .filter((r) => r.relation === 'place' && r.kind === 'PLACE')
            .map(link),
          experiences = related
            .filter(
              (r) => r.relation === 'experience' && r.kind === 'EXPERIENCE',
            )
            .map(link);
        return {
          ...card,
          geography: geography[0] ? link(geography[0]) : null,
          places,
          experiences,
          nearby: nearby.map((r) => ({
            ...link(r),
            distance_meters: r.distance_meters,
          })),
          sources: [
            ...new Map(
              [
                ...card.sources,
                ...places.flatMap((x) => x.sources),
                ...experiences.flatMap((x) => x.sources),
                ...nearby.flatMap((x) => x.source),
                ...edgeSources,
              ].map((s) => [s.id, s]),
            ).values(),
          ],
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }
}
