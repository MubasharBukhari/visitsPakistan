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
