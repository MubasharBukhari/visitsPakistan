import type { SearchResponse } from '@visitspakistan/domain';
import { GET } from '../apps/web/src/app/api/search/route';
const response: SearchResponse = {
  query: 'Hunza',
  page: 1,
  pageSize: 12,
  total: 1,
  totalPages: 1,
  groups: [
    {
      type: 'PLACE',
      total: 1,
      results: [
        {
          id: 'lake',
          type: 'PLACE',
          locale: 'en',
          name: 'Attabad Lake',
          slug: 'attabad-lake',
          alternative_names: [],
          summary: 'Sourced canonical summary',
          category: 'nature',
          tags: [],
          destination_slugs: ['hunza'],
          context_names: ['Hunza'],
          family_suitable: null,
          location: null,
          last_verified: '2026-10-04T00:00:00Z',
          url: '/places/attabad-lake/',
        },
      ],
    },
  ],
  suggestions: [],
};
afterEach(() => jest.restoreAllMocks());
test('SSR search page renders grouped canonical links, freshness and noindex metadata', async () => {
  const { default: Page, metadata } =
    await import('../apps/web/src/app/(discovery)/search/page');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json(response));
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ q: 'Hunza' }) }),
  );
  for (const text of [
    'Attractions',
    'Attabad Lake',
    'Sourced canonical summary',
    'Verified',
    'href="/places/attabad-lake"',
    'method="get"',
  ])
    expect(html).toContain(text);
  expect(metadata.robots).toMatchObject({ index: false, follow: true });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('q=Hunza'),
    expect.objectContaining({ cache: 'no-store' }),
  );
});
test('empty results offer search ideas and outages retain explicit error state', async () => {
  const { default: Page } =
    await import('../apps/web/src/app/(discovery)/search/page');
  const { renderToStaticMarkup } = await import('react-dom/server');
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json({ ...response, total: 0, groups: [], suggestions: [] }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  expect(
    renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ q: 'missing' }) }),
    ),
  ).toContain('No published discoveries');
  expect(
    renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ q: 'offline' }) }),
    ),
  ).toContain('temporarily unavailable');
});
test('autocomplete BFF validates query, redacts upstream failures and prevents successful caching', async () => {
  expect(
    (await GET(new Request('http://localhost/api/search/?q=a&type=PARTNER')))
      .status,
  ).toBe(422);
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json(response))
    .mockRejectedValueOnce(new Error('secret transport URL'));
  const success = await GET(
    new Request('http://localhost/api/search/?q=Hunza&autocomplete=true'),
  );
  expect(success.status).toBe(200);
  expect(success.headers.get('Cache-Control')).toBe('no-store');
  const failure = await GET(
    new Request('http://localhost/api/search/?q=Hunza'),
  );
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain('secret');
});
