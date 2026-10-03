import {
  KnowledgeGraphService,
  normalizeRelation,
  validateCoordinates,
} from './knowledge-graph';
import type {
  KnowledgeGraphRepository,
  RelationInput,
} from './knowledge-graph';
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
function repository(): jest.Mocked<KnowledgeGraphRepository> {
  return {
    createGeo: jest.fn(),
    createPlace: jest.fn(),
    createExperience: jest.fn(),
    createContent: jest.fn(),
    createRelation: jest.fn(),
    findGeo: jest.fn(),
    nearbyPlaces: jest.fn(),
    relationsFor: jest.fn(),
  };
}
test('rejects invalid identity, hierarchy roots, coordinates and experience facts before repository writes', () => {
  const repo = repository();
  const service = new KnowledgeGraphService(repo);
  expect(() =>
    service.createGeo({
      id: a,
      name: 'Hunza',
      slug: 'hunza',
      type: 'DESTINATION',
    }),
  ).toThrow('Only countries');
  expect(() =>
    service.createGeo({
      id: a,
      name: 'Pakistan',
      slug: 'Pakistan',
      type: 'COUNTRY',
    }),
  ).toThrow('slug');
  expect(() =>
    service.createGeo({
      id: a,
      name: 'Pakistan',
      slug: 'pakistan',
      type: 'COUNTRY',
      coordinates: { latitude: 91, longitude: 0 },
    }),
  ).toThrow('WGS84');
  expect(() =>
    service.createExperience({
      id: b,
      name: 'Walk',
      slug: 'walk',
      category: 'WALK',
      durationMinutes: -1,
    }),
  ).toThrow('duration');
  expect(repo.createGeo).not.toHaveBeenCalled();
  expect(repo.createExperience).not.toHaveBeenCalled();
});
test('normalizes symmetric NEAR identity while preserving endpoint types', () => {
  const repo = repository();
  const service = new KnowledgeGraphService(repo);
  service.createRelation({
    sourceId: b,
    sourceKind: 'PLACE',
    targetId: a,
    targetKind: 'GEO_ENTITY',
    type: 'NEAR',
  });
  expect(repo.createRelation).toHaveBeenCalledWith({
    sourceId: a,
    sourceKind: 'GEO_ENTITY',
    targetId: b,
    targetKind: 'PLACE',
    type: 'NEAR',
  });
});
test.each([
  ['HAS_ATTRACTION', 'GEO_ENTITY', 'PLACE'],
  ['HAS_EXPERIENCE', 'PLACE', 'EXPERIENCE'],
  ['PART_OF', 'PLACE', 'GEO_ENTITY'],
  ['HAS_CUISINE', 'GEO_ENTITY', 'CUISINE'],
  ['HAS_ROUTE', 'GEO_ENTITY', 'ROUTE'],
  ['ABOUT', 'CONTENT_ITEM', 'GEO_ENTITY'],
  ['VISITS', 'EXPERIENCE', 'PLACE'],
  ['OPERATES', 'PARTNER', 'TRAVEL_PRODUCT'],
] as const)(
  'accepts the typed %s relation contract',
  (type, sourceKind, targetKind) => {
    expect(
      normalizeRelation({
        sourceId: a,
        targetId: b,
        sourceKind,
        targetKind,
        type,
      }),
    ).toMatchObject({ type });
  },
);
test('rejects invalid relation directions, self-links, unknown types and non-finite weights', () => {
  const input: RelationInput = {
    sourceId: a,
    targetId: b,
    sourceKind: 'GEO_ENTITY',
    targetKind: 'PLACE',
    type: 'HAS_ATTRACTION',
  };
  expect(() =>
    normalizeRelation({ ...input, sourceKind: 'EXPERIENCE' }),
  ).toThrow('endpoints');
  expect(() => normalizeRelation({ ...input, targetId: a })).toThrow(
    'endpoints',
  );
  expect(() => normalizeRelation({ ...input, weight: NaN })).toThrow('weight');
});
test('bounds proximity queries and delegates valid coordinates in longitude/latitude order', () => {
  const repo = repository();
  const service = new KnowledgeGraphService(repo);
  expect(() =>
    service.nearbyPlaces({
      coordinates: { latitude: 35, longitude: 75 },
      radiusMeters: 0,
    }),
  ).toThrow('bounds');
  expect(() =>
    validateCoordinates({ latitude: Infinity, longitude: 75 }),
  ).toThrow('WGS84');
  const query = {
    coordinates: { latitude: 35, longitude: 75 },
    radiusMeters: 1000,
    limit: 10,
  };
  service.nearbyPlaces(query);
  expect(repo.nearbyPlaces).toHaveBeenCalledWith(query);
});

test('attraction facts reject invalid duration and season before persistence, while unknown facts remain optional', () => {
  const repo = repository();
  const service = new KnowledgeGraphService(repo);
  const place = {
    id: a,
    name: 'Lake',
    slug: 'lake',
    geoEntityId: b,
    type: 'NATURAL_ATTRACTION' as const,
  };
  expect(() =>
    service.createPlace({ ...place, durationMinutes: 10081 }),
  ).toThrow('duration');
  expect(() => service.createPlace({ ...place, seasons: ['monsoon'] })).toThrow(
    'season',
  );
  expect(() =>
    service.createExperience({
      id: a,
      name: 'Walk',
      slug: 'walk',
      category: 'walking',
      seasons: ['made-up'],
    }),
  ).toThrow('season');
  expect(repo.createPlace).not.toHaveBeenCalled();
  service.createPlace(place);
  expect(repo.createPlace).toHaveBeenCalledWith(place);
});
