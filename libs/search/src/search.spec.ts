import { OpenSearchClient, SearchUnavailable } from './client';
import {
  searchBody,
  indexDefinition,
  indexFamilies,
  canonicalSearchUrl,
} from './schema';
import { UnifiedSearch } from './service';
import { searchQuerySchema } from '@visitspakistan/domain';
afterEach(() => jest.restoreAllMocks());
test('safe search DSL bounds fuzziness, canonical identity filters and pagination without query string syntax', () => {
  const q = searchQuerySchema.parse({ q: 'Hunza OR *', page: 2 });
  const body = searchBody(q, ['canonical-id']);
  expect(body.from).toBe(12);
  expect(JSON.stringify(body)).toContain('canonical-id');
  expect(JSON.stringify(body)).not.toContain('query_string');
  expect(JSON.stringify(body)).not.toMatch(/subscription|commercial|paid/);
  expect(indexDefinition().mappings.dynamic).toBe('strict');
  expect(indexFamilies.CONTENT).toBe('content_v1');
  expect(
    canonicalSearchUrl({ type: 'PLACE', slug: 'attabad', locale: 'ur' }),
  ).toBe('/places/attabad/?locale=ur');
});
test.each([
  { q: '' },
  { q: 'x'.repeat(121) },
  { q: 'hi', type: 'PRODUCT' },
  { q: 'hi', lat: 20 },
  { q: 'hi', page: 101 },
  { q: 'hi', autocomplete: 'yes' },
])('rejects malformed query %j', (q) =>
  expect(searchQuerySchema.safeParse(q).success).toBe(false),
);
test('bulk item failures are rejected even when OpenSearch responds HTTP 200', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      Response.json({ errors: true, items: [{ delete: { status: 429 } }] }),
    );
  await expect(
    new OpenSearchClient('http://localhost:9200').bulk(
      [],
      [{ id: 'a', type: 'PLACE' }],
    ),
  ).rejects.toThrow(SearchUnavailable);
});
test('unavailable OpenSearch is explicit rather than a fabricated empty result', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  await expect(
    new OpenSearchClient('http://localhost:9200').query(
      'PLACE',
      searchQuerySchema.parse({ q: 'Hunza' }),
      ['id'],
    ),
  ).rejects.toThrow('temporarily unavailable');
});
test('canonical eligibility excludes withdrawn identities even if returned by a stale engine', async () => {
  const os = new OpenSearchClient('http://localhost:9200');
  jest
    .spyOn(os, 'query')
    .mockResolvedValue({ total: 2, ids: ['safe', 'withdrawn'] });
  const canonical = {
    snapshot: async () => [
      {
        id: 'safe',
        type: 'PLACE' as const,
        locale: 'en',
        name: 'Safe',
        slug: 'safe',
        alternative_names: [],
        summary: null,
        category: null,
        tags: [],
        destination_slugs: [],
        context_names: [],
        family_suitable: null,
        location: null,
        last_verified: '2026-10-04T00:00:00Z',
      },
    ],
  };
  const r = await new UnifiedSearch(canonical, os).query({ q: 'safe' });
  expect(r.groups.flatMap((g) => g.results.map((d) => d.id))).toEqual(['safe']);
});
