import {
  jsonLd,
  absoluteUrl,
  destinationPath,
  destinationStructuredData,
  safeSourceUrl,
} from '../apps/web/src/lib/destination-seo';
import {
  getDestinations,
  getDestination,
} from '../apps/web/src/lib/destination-api';
import type { DestinationDetail } from '@visitspakistan/domain';
afterEach(() => jest.restoreAllMocks());
test('JSON-LD serialization cannot close its script element', () => {
  const value = jsonLd({ name: '</script><script>alert(1)</script>' });
  expect(value).not.toContain('<');
  expect(JSON.parse(value).name).toContain('</script>');
});
test('source URLs reject script schemes and preserve HTTPS', () => {
  expect(safeSourceUrl('javascript:alert(1)')).toBeNull();
  expect(safeSourceUrl('https://example.org/source')).toBe(
    'https://example.org/source',
  );
});
test('locale-aware canonical destination path uses escaped identity', () => {
  expect(destinationPath('hunza', 'ur')).toBe('/destinations/hunza/?locale=ur');
  expect(absoluteUrl(destinationPath('hunza'))).toContain(
    '/destinations/hunza/',
  );
});
test('TouristDestination JSON-LD contains only approved fields and matching breadcrumbs', () => {
  const d = {
    canonical: {
      id: 'canonical-id',
      name: 'Hunza',
      slug: 'hunza',
      locale: 'en',
      coordinates: { latitude: 36.3, longitude: 74.6 },
    },
    region: { name: 'Gilgit-Baltistan' },
    attractions: [{ id: 'attraction-id', name: 'Attabad Lake' }],
    editorial: null,
  } as unknown as DestinationDetail;
  const structured = destinationStructuredData(d);
  expect(structured[0]).toMatchObject({
    '@type': 'TouristDestination',
    name: 'Hunza',
    geo: { latitude: 36.3, longitude: 74.6 },
  });
  expect(structured[0]).not.toHaveProperty('offers');
  expect(structured[1]).toMatchObject({ '@type': 'BreadcrumbList' });
});
test('public detail distinguishes missing destinations from API failure', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  expect(await getDestination('missing')).toBeNull();
  await expect(getDestination('unavailable')).rejects.toThrow(
    'temporarily unavailable',
  );
});
test('directory reads are no-store and preserve validated filters', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json({ data: [], pagination: { total: 0 }, facets: {} }),
    );
  await getDestinations({
    page: 2,
    pageSize: 12,
    locale: 'en',
    interest: 'nature',
    season: 'summer',
  });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('interest=nature'),
    expect.objectContaining({ cache: 'no-store' }),
  );
});

test('destination directory SSR renders cards, GET filters and query canonical metadata', async () => {
  const { default: Directory, generateMetadata } =
    await import('../apps/web/src/app/destinations/(directory)/page');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const card = {
    canonical: { id: 'test-hunza', name: 'Hunza', slug: 'hunza', locale: 'en' },
    region: { name: 'Gilgit-Baltistan' },
    interests: ['nature'],
    editorial: null,
  };
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    Response.json({
      data: [card],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
      facets: { regions: [], interests: ['nature'], seasons: ['summer'] },
    }),
  );
  const props = { searchParams: Promise.resolve({ interest: 'nature' }) };
  const html = renderToStaticMarkup(await Directory(props));
  expect(html).toContain('Hunza');
  expect(html).toContain('method="get"');
  expect(html).toContain('/destinations/hunza/');
  expect(html).toContain('application/ld+json');
  const metadata = await generateMetadata(props);
  expect(metadata.robots).toMatchObject({ index: false, follow: true });
  expect(metadata.alternates?.canonical).toContain('/destinations/');
});

test('malformed destination slugs are missing pages without requesting invalid API paths', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  expect(await getDestination('NOT-a-slug')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

test('Sprint 1 detail renders semantic editorial sections, FAQ and geographic links in initial HTML', async () => {
  const { default: Detail, generateMetadata } =
    await import('../apps/web/src/app/destinations/[slug]/page');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const destination = {
    canonical: {
      id: 'test',
      name: 'Hunza',
      slug: 'hunza',
      locale: 'en',
      timezone: 'Asia/Karachi',
      coordinates: null,
    },
    region: { name: 'Gilgit-Baltistan', slug: 'gilgit-baltistan' },
    hierarchy: [{ name: 'Pakistan' }, { name: 'Gilgit-Baltistan' }],
    interests: [],
    seasons: [],
    sources: [],
    last_verified: '2026-10-02T00:00:00Z',
    geographic_parent: { name: 'Gilgit-Baltistan', destination_slug: null },
    geographic_children: [
      {
        id: 'child',
        name: 'Published child',
        slug: 'child',
        destination_slug: 'child',
        last_verified: '2026-10-02T00:00:00Z',
      },
    ],
    related_destinations: [],
    attractions: [],
    experiences: [],
    food: [],
    guides: [],
    editorial: {
      title: 'Hunza editorial',
      summary: 'Introduction',
      seoTitle: 'Hunza destination guide',
      metaDescription: 'Sourced description',
      author: { displayName: 'Author' },
      reviewer: { displayName: 'Reviewer' },
      lastUpdated: '2026-10-02T00:00:00Z',
      lastVerified: '2026-10-02T00:00:00Z',
      blocks: [],
      heroMedia: null,
      slug: 'hunza-editorial',
      destination: {
        quickAnswer: 'A concise sourced answer',
        overview: 'Sourced overview',
        whyVisit: 'Sourced visitor perspective',
        bestTime: 'Reviewed season advice',
        travelTips: ['A verified travel tip'],
        faq: [
          {
            question: 'Where is Hunza?',
            answer: 'Refer to canonical geography.',
          },
        ],
      },
    },
  };
  jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => Response.json(destination));
  const props = {
    params: Promise.resolve({ slug: 'hunza' }),
    searchParams: Promise.resolve({}),
  };
  const html = renderToStaticMarkup(await Detail(props));
  for (const text of [
    'Quick answer',
    'Sourced overview',
    'Reviewed season advice',
    'A verified travel tip',
    'Where is Hunza?',
    'Reviewed by Reviewer',
    'href="/destinations/child"',
    'application/ld+json',
  ])
    expect(html).toContain(text);
  expect(html).toContain('<details>');
  const metadata = await generateMetadata(props);
  expect(metadata.title).toBe('Hunza destination guide');
  expect(metadata.description).toBe('Sourced description');
  expect(metadata.openGraph).toMatchObject({
    title: 'Hunza destination guide',
    type: 'website',
  });
});

test('destination sitemap uses published API pages, canonical URLs and actual update dates', async () => {
  const { default: sitemap } = await import('../apps/web/src/app/sitemap');
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json({
        data: [
          {
            canonical: {
              slug: 'hunza',
              locale: 'en',
              updated_at: '2026-10-01T00:00:00Z',
            },
            editorial: { lastUpdated: '2026-10-02T00:00:00Z' },
          },
        ],
        pagination: { total: 2, totalPages: 2 },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        data: [
          {
            canonical: {
              slug: 'skardu',
              locale: 'en',
              updated_at: '2026-10-01T00:00:00Z',
            },
            editorial: null,
          },
        ],
        pagination: { total: 2, totalPages: 2 },
      }),
    );
  fetch.mockResolvedValueOnce(
    Response.json({
      data: [
        {
          canonical: {
            kind: 'PLACE',
            slug: 'attabad-lake',
            locale: 'en',
            updated_at: '2026-10-01T00:00:00Z',
          },
          editorial: null,
        },
        {
          canonical: {
            kind: 'EXPERIENCE',
            slug: 'boating',
            locale: 'en',
            updated_at: '2026-10-01T00:00:00Z',
          },
          editorial: null,
        },
      ],
      pagination: { total: 2, totalPages: 1 },
    }),
  );
  const entries = await sitemap();
  expect(entries.map((e) => e.url)).toEqual([
    absoluteUrl('/'),
    absoluteUrl('/destinations/'),
    absoluteUrl('/things-to-do/'),
    absoluteUrl('/destinations/hunza/'),
    absoluteUrl('/destinations/skardu/'),
    absoluteUrl('/places/attabad-lake/'),
    absoluteUrl('/experiences/boating/'),
  ]);
  expect(entries[3]!.lastModified).toEqual(new Date('2026-10-02T00:00:00Z'));
  expect(fetch.mock.calls[1]![0]).toEqual(expect.stringContaining('page=2'));
});
test('robots and llms discovery point to canonical public destination URLs', async () => {
  const { default: robots } = await import('../apps/web/src/app/robots');
  const { GET } = await import('../apps/web/src/app/llms.txt/route');
  expect(robots().sitemap).toBe(absoluteUrl('/sitemap.xml'));
  expect(await GET().text()).toContain(absoluteUrl('/destinations/'));
});
