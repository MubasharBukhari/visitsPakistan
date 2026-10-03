export const entityKinds = [
  'GEO_ENTITY',
  'PLACE',
  'EXPERIENCE',
  'CONTENT_ITEM',
  'CUISINE',
  'ROUTE',
  'PARTNER',
  'TRAVEL_PRODUCT',
] as const;
export type EntityKind = (typeof entityKinds)[number];
export type ImplementedKind = Extract<
  EntityKind,
  'GEO_ENTITY' | 'PLACE' | 'EXPERIENCE' | 'CONTENT_ITEM'
>;
export const geoTypes = [
  'COUNTRY',
  'REGION',
  'PROVINCE_TERRITORY',
  'CITY',
  'DESTINATION',
  'NEIGHBOURHOOD',
] as const;
export type GeoType = (typeof geoTypes)[number];
export type PublicationStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'PUBLISHED'
  | 'WITHDRAWN';
export type RelationType =
  | 'HAS_ATTRACTION'
  | 'HAS_EXPERIENCE'
  | 'NEAR'
  | 'PART_OF'
  | 'HAS_CUISINE'
  | 'HAS_ROUTE'
  | 'ABOUT'
  | 'VISITS'
  | 'OPERATES';
export interface Coordinates {
  longitude: number;
  latitude: number;
}
export interface EntityIdentity {
  id: string;
  name: string;
  slug: string;
  locale?: string;
  primarySourceId?: string;
}
export interface GeoInput extends EntityIdentity {
  type: GeoType;
  parentId?: string;
  coordinates?: Coordinates;
  summary?: string;
  altNames?: string[];
  timezone?: string;
}
export const placeTypes = [
  'ATTRACTION',
  'RESTAURANT',
  'HOTEL',
  'MARKET',
  'VENUE',
  'TRANSPORT_POINT',
  'LANDMARK',
  'NATURAL_ATTRACTION',
] as const;
export type PlaceType = (typeof placeTypes)[number];
export const attractionTypes: readonly PlaceType[] = [
  'ATTRACTION',
  'LANDMARK',
  'NATURAL_ATTRACTION',
];
export interface PlaceInput extends EntityIdentity {
  type: PlaceType;
  geoEntityId: string;
  coordinates?: Coordinates;
  altNames?: string[];
  summary?: string;
  category?: string;
  openingInformation?: string;
  admissionInformation?: string;
  durationMinutes?: number;
  bestTime?: string;
  seasons?: string[];
  familySuitable?: boolean;
  accessibility?: string;
  facilities?: string[];
}
export interface ExperienceInput extends EntityIdentity {
  altNames?: string[];
  summary?: string;
  familySuitable?: boolean;
  category: string;
  geoEntityId?: string;
  difficulty?: string;
  durationMinutes?: number;
  seasons?: string[];
}
export interface ContentInput extends EntityIdentity {
  type: 'GUIDE' | 'STORY' | 'COLLECTION';
  primaryEntityId?: string;
  cmsExternalId?: string;
}
export interface RelationInput {
  sourceId: string;
  sourceKind: EntityKind;
  targetId: string;
  targetKind: EntityKind;
  type: RelationType;
  sourceRecordId?: string;
  weight?: number;
}
export interface EntityProjection {
  id: string;
  kind: EntityKind;
  name: string;
  slug: string;
  status: PublicationStatus;
  lastVerified: Date | null;
}
export interface GeoProjection extends EntityProjection {
  type: GeoType;
  parentId: string | null;
  coordinates: Coordinates | null;
}
export interface NearbyPlace extends EntityProjection {
  distanceMeters: number;
}
export interface ProximityQuery {
  coordinates: Coordinates;
  radiusMeters: number;
  limit?: number;
}
export interface KnowledgeGraphRepository {
  createGeo(input: GeoInput): Promise<EntityProjection>;
  createPlace(input: PlaceInput): Promise<EntityProjection>;
  createExperience(input: ExperienceInput): Promise<EntityProjection>;
  createContent(input: ContentInput): Promise<EntityProjection>;
  createRelation(input: RelationInput): Promise<string>;
  findGeo(id: string): Promise<GeoProjection | null>;
  nearbyPlaces(query: ProximityQuery): Promise<NearbyPlace[]>;
  relationsFor(id: string): Promise<
    Array<{
      id: string;
      type: RelationType;
      sourceId: string;
      targetId: string;
    }>
  >;
}
const rules: Record<
  RelationType,
  readonly [readonly EntityKind[], readonly EntityKind[]]
> = {
  HAS_ATTRACTION: [['GEO_ENTITY'], ['PLACE']],
  HAS_EXPERIENCE: [['GEO_ENTITY', 'PLACE'], ['EXPERIENCE']],
  NEAR: [
    ['GEO_ENTITY', 'PLACE'],
    ['GEO_ENTITY', 'PLACE'],
  ],
  PART_OF: [['GEO_ENTITY', 'PLACE', 'EXPERIENCE'], ['GEO_ENTITY']],
  HAS_CUISINE: [['GEO_ENTITY', 'PLACE'], ['CUISINE']],
  HAS_ROUTE: [['GEO_ENTITY'], ['ROUTE']],
  ABOUT: [['CONTENT_ITEM'], entityKinds.filter((k) => k !== 'CONTENT_ITEM')],
  VISITS: [
    ['EXPERIENCE', 'ROUTE', 'TRAVEL_PRODUCT'],
    ['GEO_ENTITY', 'PLACE'],
  ],
  OPERATES: [['PARTNER'], ['ROUTE', 'TRAVEL_PRODUCT']],
};
export function validateUuid(value: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error('A canonical UUID is required');
}
export function validateCoordinates(point: Coordinates): void {
  if (
    !Number.isFinite(point.longitude) ||
    !Number.isFinite(point.latitude) ||
    Math.abs(point.longitude) > 180 ||
    Math.abs(point.latitude) > 90
  )
    throw new Error('Invalid WGS84 coordinates');
}
function validateIdentity(input: EntityIdentity): void {
  validateUuid(input.id);
  if (!input.name.trim() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug))
    throw new Error('Name and canonical slug are required');
  if (input.locale && !/^[a-z]{2}(-[A-Z]{2})?$/.test(input.locale))
    throw new Error('Invalid locale');
  if (input.primarySourceId) validateUuid(input.primarySourceId);
}
export function normalizeRelation(input: RelationInput): RelationInput {
  validateUuid(input.sourceId);
  validateUuid(input.targetId);
  if (input.sourceRecordId) validateUuid(input.sourceRecordId);
  const rule = rules[input.type];
  if (
    !rule ||
    !rule[0].includes(input.sourceKind) ||
    !rule[1].includes(input.targetKind) ||
    input.sourceId.toLowerCase() === input.targetId.toLowerCase()
  )
    throw new Error('Invalid relation endpoints');
  if (
    input.weight !== undefined &&
    (!Number.isFinite(input.weight) || input.weight < 0 || input.weight > 1)
  )
    throw new Error('Relation weight must be between zero and one');
  if (
    input.type === 'NEAR' &&
    input.sourceId.toLowerCase() > input.targetId.toLowerCase()
  )
    return {
      ...input,
      sourceId: input.targetId,
      sourceKind: input.targetKind,
      targetId: input.sourceId,
      targetKind: input.sourceKind,
    };
  return input;
}
/** Commands create drafts only. Publication/authentication workflows are not exposed here. */
export class KnowledgeGraphService {
  constructor(private readonly repository: KnowledgeGraphRepository) {}
  createGeo(input: GeoInput) {
    validateIdentity(input);
    if (!geoTypes.includes(input.type))
      throw new Error('Invalid geographic tier');
    if ((input.type === 'COUNTRY') !== (input.parentId === undefined))
      throw new Error('Only countries may have no parent');
    if (input.parentId) validateUuid(input.parentId);
    if (input.coordinates) validateCoordinates(input.coordinates);
    if (input.timezone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: input.timezone });
      } catch {
        throw new Error('Invalid timezone');
      }
    }
    return this.repository.createGeo(input);
  }
  createPlace(input: PlaceInput) {
    validateIdentity(input);
    validateUuid(input.geoEntityId);
    if (!placeTypes.includes(input.type)) throw new Error('Invalid place type');
    if (
      input.durationMinutes !== undefined &&
      (!Number.isInteger(input.durationMinutes) ||
        input.durationMinutes < 1 ||
        input.durationMinutes > 10080)
    )
      throw new Error('Invalid recommended duration');
    validateSeasons(input.seasons?.map((s) => s.toLowerCase()));
    if (input.coordinates) validateCoordinates(input.coordinates);
    return this.repository.createPlace({
      ...input,
      ...(input.seasons
        ? { seasons: input.seasons.map((s) => s.toLowerCase()) }
        : {}),
    });
  }
  createExperience(input: ExperienceInput) {
    validateIdentity(input);
    if (input.geoEntityId) validateUuid(input.geoEntityId);
    if (
      !input.category.trim() ||
      (input.durationMinutes !== undefined &&
        (!Number.isInteger(input.durationMinutes) ||
          input.durationMinutes <= 0 ||
          input.durationMinutes > 10080))
    )
      throw new Error('Invalid experience category/duration');
    validateSeasons(input.seasons?.map((s) => s.toLowerCase()));
    return this.repository.createExperience({
      ...input,
      ...(input.seasons
        ? { seasons: input.seasons.map((s) => s.toLowerCase()) }
        : {}),
    });
  }
  createContent(input: ContentInput) {
    validateIdentity(input);
    if (input.primaryEntityId) validateUuid(input.primaryEntityId);
    return this.repository.createContent(input);
  }
  createRelation(input: RelationInput) {
    return this.repository.createRelation(normalizeRelation(input));
  }
  findGeo(id: string) {
    validateUuid(id);
    return this.repository.findGeo(id);
  }
  nearbyPlaces(query: ProximityQuery) {
    validateCoordinates(query.coordinates);
    if (
      !Number.isFinite(query.radiusMeters) ||
      query.radiusMeters <= 0 ||
      query.radiusMeters > 500000 ||
      (query.limit !== undefined &&
        (!Number.isInteger(query.limit) ||
          query.limit < 1 ||
          query.limit > 100))
    )
      throw new Error('Invalid proximity bounds');
    return this.repository.nearbyPlaces(query);
  }
  relationsFor(id: string) {
    validateUuid(id);
    return this.repository.relationsFor(id);
  }
}

function validateSeasons(seasons?: string[]) {
  if (
    seasons?.some(
      (season) =>
        !['spring', 'summer', 'autumn', 'winter', 'all-year'].includes(season),
    )
  )
    throw new Error('Invalid season tag');
}
