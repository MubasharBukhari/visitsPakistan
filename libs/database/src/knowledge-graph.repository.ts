import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/client';
import type {
  ContentInput,
  EntityIdentity,
  EntityProjection,
  ExperienceInput,
  GeoInput,
  GeoProjection,
  KnowledgeGraphRepository,
  NearbyPlace,
  PlaceInput,
  ProximityQuery,
  RelationInput,
} from '@visitspakistan/domain';
import { validateCoordinates } from '@visitspakistan/domain';
export function createGraphClient(url: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: 4,
      connectionTimeoutMillis: 3000,
      query_timeout: 10000,
    }),
  });
}
function identity(
  input: EntityIdentity,
  kind: 'GEO_ENTITY' | 'PLACE' | 'EXPERIENCE' | 'CONTENT_ITEM',
) {
  return {
    id: input.id,
    kind,
    name: input.name,
    slug: input.slug,
    locale: input.locale ?? 'en',
    primarySourceId: input.primarySourceId,
  };
}
const projection = {
  id: true,
  kind: true,
  name: true,
  slug: true,
  status: true,
  lastVerified: true,
} as const;
/** Caller supplies one transaction context for every multi-record command. */
export class PrismaKnowledgeGraphRepository implements KnowledgeGraphRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}
  async createGeo(input: GeoInput): Promise<EntityProjection> {
    const entity = await this.tx.entityRegistry.create({
      data: {
        ...identity(input, 'GEO_ENTITY'),
        geoEntity: {
          create: {
            type: input.type,
            parentId: input.parentId,
            altNames: input.altNames,
            timezone: input.timezone,
          },
        },
      },
      select: projection,
    });
    if (input.coordinates) {
      validateCoordinates(input.coordinates);
      await this.tx
        .$executeRaw`UPDATE geo_entity SET location=ST_SetSRID(ST_MakePoint(${input.coordinates.longitude},${input.coordinates.latitude}),4326)::geography WHERE id=${input.id}::uuid`;
    }
    return entity;
  }
  async createPlace(input: PlaceInput): Promise<EntityProjection> {
    const entity = await this.tx.entityRegistry.create({
      data: {
        ...identity(input, 'PLACE'),
        place: { create: { type: input.type, geoEntityId: input.geoEntityId } },
      },
      select: projection,
    });
    if (input.coordinates) {
      validateCoordinates(input.coordinates);
      await this.tx
        .$executeRaw`UPDATE place SET location=ST_SetSRID(ST_MakePoint(${input.coordinates.longitude},${input.coordinates.latitude}),4326)::geography WHERE id=${input.id}::uuid`;
    }
    return entity;
  }
  async createExperience(input: ExperienceInput): Promise<EntityProjection> {
    return this.tx.entityRegistry.create({
      data: {
        ...identity(input, 'EXPERIENCE'),
        experience: {
          create: {
            category: input.category,
            geoEntityId: input.geoEntityId,
            difficulty: input.difficulty,
            durationMinutes: input.durationMinutes,
            seasons: input.seasons,
          },
        },
      },
      select: projection,
    });
  }
  async createContent(input: ContentInput): Promise<EntityProjection> {
    return this.tx.entityRegistry.create({
      data: {
        ...identity(input, 'CONTENT_ITEM'),
        contentItem: {
          create: {
            type: input.type,
            primaryEntityId: input.primaryEntityId,
            cmsExternalId: input.cmsExternalId,
          },
        },
      },
      select: projection,
    });
  }
  async createRelation(input: RelationInput): Promise<string> {
    return (
      await this.tx.entityRelation.create({ data: input, select: { id: true } })
    ).id;
  }
  async findGeo(id: string): Promise<GeoProjection | null> {
    // Internal administrative projection excludes withdrawn/deleted records; no public endpoint exists.
    const result = await this.tx.$queryRaw<
      GeoProjection[]
    >`SELECT e.id,e.kind,e.name,e.slug,e.status,e.last_verified AS "lastVerified",g.type,g.parent_id AS "parentId", CASE WHEN g.location IS NULL THEN NULL ELSE json_build_object('longitude',ST_X(g.location::geometry),'latitude',ST_Y(g.location::geometry)) END AS coordinates FROM geo_entity g JOIN entity_registry e ON e.id=g.id WHERE e.id=${id}::uuid AND e.deleted_at IS NULL AND e.status<>'WITHDRAWN'`;
    return result[0] ?? null;
  }
  async nearbyPlaces(query: ProximityQuery): Promise<NearbyPlace[]> {
    validateCoordinates(query.coordinates);
    const { longitude, latitude } = query.coordinates;
    // Public query requires active verified source and geographic owner eligibility.
    return this.tx.$queryRaw<
      NearbyPlace[]
    >`SELECT e.id,e.kind,e.name,e.slug,e.status,e.last_verified AS "lastVerified", ST_Distance(p.location,ST_SetSRID(ST_MakePoint(${longitude},${latitude}),4326)::geography) AS "distanceMeters" FROM place p JOIN entity_registry e ON e.id=p.id JOIN entity_registry geo ON geo.id=p.geo_entity_id JOIN source_record src ON src.id=e.primary_source_id JOIN source_record gs ON gs.id=geo.primary_source_id WHERE e.status='PUBLISHED' AND e.deleted_at IS NULL AND src.retired_at IS NULL AND src.source_type<>'DEVELOPMENT_FIXTURE' AND geo.status='PUBLISHED' AND geo.deleted_at IS NULL AND gs.retired_at IS NULL AND gs.source_type<>'DEVELOPMENT_FIXTURE' AND ST_DWithin(p.location,ST_SetSRID(ST_MakePoint(${longitude},${latitude}),4326)::geography,${query.radiusMeters}) ORDER BY "distanceMeters", e.id LIMIT ${query.limit ?? 20}`;
  }
  async relationsFor(id: string) {
    return this.tx.$queryRaw<
      Array<{
        id: string;
        type: RelationInput['type'];
        sourceId: string;
        targetId: string;
      }>
    >`SELECT r.id,r.type,r.source_id AS "sourceId",r.target_id AS "targetId" FROM entity_relation r JOIN entity_registry s ON s.id=r.source_id JOIN entity_registry t ON t.id=r.target_id JOIN source_record rs ON rs.id=r.source_record_id JOIN source_record ss ON ss.id=s.primary_source_id JOIN source_record ts ON ts.id=t.primary_source_id WHERE (r.source_id=${id}::uuid OR r.target_id=${id}::uuid) AND r.status='PUBLISHED' AND r.deleted_at IS NULL AND s.status='PUBLISHED' AND s.deleted_at IS NULL AND t.status='PUBLISHED' AND t.deleted_at IS NULL AND rs.retired_at IS NULL AND ss.retired_at IS NULL AND ts.retired_at IS NULL AND rs.source_type<>'DEVELOPMENT_FIXTURE' AND ss.source_type<>'DEVELOPMENT_FIXTURE' AND ts.source_type<>'DEVELOPMENT_FIXTURE' ORDER BY r.id`;
  }
}
export async function graphTransaction<T>(
  client: PrismaClient,
  work: (
    repository: PrismaKnowledgeGraphRepository,
    tx: Prisma.TransactionClient,
  ) => Promise<T>,
): Promise<T> {
  return client.$transaction(
    (tx) => work(new PrismaKnowledgeGraphRepository(tx), tx),
    { isolationLevel: 'Serializable', timeout: 15000 },
  );
}
