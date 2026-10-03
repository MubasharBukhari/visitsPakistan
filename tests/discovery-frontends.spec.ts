import type { DiscoveryDetail } from '@visitspakistan/domain';
import {
  discoveryMetadata,
  discoveryStructuredData,
  entityPath,
} from '../apps/web/src/lib/discovery-seo';
import { getDiscovery } from '../apps/web/src/lib/discovery-api';
const detail = (kind: 'PLACE' | 'EXPERIENCE' = 'PLACE'): DiscoveryDetail => ({
  canonical: {
    id: 'lake',
    kind,
    name: 'Attabad Lake',
    slug: 'attabad-lake',
    locale: 'en',
    place_type: kind === 'PLACE' ? 'NATURAL_ATTRACTION' : null,
    geo_entity_id: 'hunza',
    alt_names: [],
    summary: 'Sourced lake summary',
    category: 'nature',
    coordinates:
      kind === 'PLACE' ? { latitude: 36.337, longitude: 74.867 } : null,
    opening_information: null,
    admission_information: null,
    duration_minutes: null,
    best_time: null,
    seasons: [],
    family_suitable: null,
    accessibility: null,
    facilities: [],
    difficulty: null,
    status: 'PUBLISHED',
    last_verified: '2026-10-02T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
    sources: [],
  },
  editorial: null,
  destinations: [
    {
      id: 'hunza',
      kind: 'GEO_ENTITY',
      name: 'Hunza',
      slug: 'hunza',
      locale: 'en',
      last_verified: '2026-10-02T00:00:00Z',
      sources: [],
    },
  ],
  geography: {
    id: 'hunza',
    kind: 'GEO_ENTITY',
    name: 'Hunza',
    slug: 'hunza',
    locale: 'en',
    last_verified: '2026-10-02T00:00:00Z',
    sources: [],
  },
  places: [],
  experiences: [
    {
      id: 'boat',
      kind: 'EXPERIENCE',
      name: 'Boating',
      slug: 'boating',
      locale: 'en',
      last_verified: '2026-10-02T00:00:00Z',
      sources: [],
    },
  ],
  nearby: [],
  sources: [],
  last_verified: '2026-10-02T00:00:00Z',
});
afterEach(() => jest.restoreAllMocks());
test('attraction and independent concept structured data use valid types without invented offers or events', () => {
  const place = discoveryStructuredData(detail());
  expect(place[0]).toMatchObject({
    '@type': 'TouristAttraction',
    geo: { latitude: 36.337, longitude: 74.867 },
  });
  expect(place[1]!.itemListElement?.map((x) => x.name)).toEqual([
    'Home',
    'Destinations',
    'Hunza',
    'Attabad Lake',
  ]);
  const concept = discoveryStructuredData(detail('EXPERIENCE'));
  expect(concept[0]!['@type']).toBe('Thing');
  expect(concept[0]).not.toHaveProperty('offers');
  expect(concept[0]).not.toHaveProperty('startDate');
  expect(concept[0]).not.toHaveProperty('geo');
  expect(entityPath({ ...detail().canonical, locale: 'ur' })).toBe(
    '/places/attabad-lake/?locale=ur',
  );
  expect(discoveryMetadata(detail()).alternates?.canonical).toContain(
    '/places/attabad-lake/',
  );
  expect(discoveryMetadata(null).robots).toMatchObject({ index: false });
});
test('discovery transport distinguishes real 404 from unavailable API and validates paths', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  expect(await getDiscovery('PLACE', 'missing')).toBeNull();
  await expect(getDiscovery('EXPERIENCE', 'offline')).rejects.toThrow(
    'temporarily unavailable',
  );
  expect(await getDiscovery('PLACE', '../private')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
});
test('discovery detail SSR includes graph navigation, unknown facts, sources and metadata', async () => {
  const { default: Page, generateMetadata } =
    await import('../apps/web/src/app/(discovery)/places/[slug]/page');
  const { renderToStaticMarkup } = await import('react-dom/server');
  jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => Response.json(detail()));
  const props = {
    params: Promise.resolve({ slug: 'attabad-lake' }),
    searchParams: Promise.resolve({}),
  };
  const html = renderToStaticMarkup(await Page(props));
  for (const value of [
    '<h1>Attabad Lake</h1>',
    'href="/experiences/boating"',
    'href="/destinations/hunza"',
    'Not yet verified',
    'Sources &amp; freshness',
    'application/ld+json',
  ])
    expect(html).toContain(value);
  expect((await generateMetadata(props)).openGraph).toMatchObject({
    type: 'website',
    title: 'Attabad Lake | VisitsPakistan',
  });
});
test('Things To Do SSR renders approved cards and bounded GET filters, with noindex filtered metadata', async () => {
  const { default: Page, generateMetadata } =
    await import('../apps/web/src/app/(discovery)/things-to-do/page');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      data: [detail()],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      facets: {
        destinations: [],
        categories: ['nature'],
        seasons: ['summer'],
      },
    }),
  );
  const props = {
    searchParams: Promise.resolve({
      category: 'nature',
      familySuitable: 'true',
      duration: '120',
    }),
  };
  const html = renderToStaticMarkup(await Page(props));
  expect(html).toContain('Attabad Lake');
  expect(html).toContain('/places/attabad-lake/');
  expect(html).toContain('method="get"');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('familySuitable=true'),
    expect.objectContaining({ cache: 'no-store' }),
  );
  expect((await generateMetadata(props)).robots).toMatchObject({
    index: false,
    follow: true,
  });
  expect(
    (await generateMetadata({ searchParams: Promise.resolve({}) })).robots,
  ).toMatchObject({ index: true });
});
test('empty Things To Do results offer filter recovery without fabricated attractions', async () => {
  const { default: Page } =
    await import('../apps/web/src/app/(discovery)/things-to-do/page');
  const { renderToStaticMarkup } = await import('react-dom/server');
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      data: [],
      pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
      facets: { destinations: [], categories: [], seasons: [] },
    }),
  );
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({}) }),
  );
  expect(html).toContain('No');
  expect(html).not.toContain('/places/attabad-lake/');
});
