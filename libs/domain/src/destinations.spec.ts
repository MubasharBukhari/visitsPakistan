import { destinationQuerySchema } from './destinations';
test('destination query supplies safe defaults and parses numeric query strings', () => {
  expect(destinationQuerySchema.parse({})).toEqual({
    page: 1,
    pageSize: 12,
    locale: 'en',
  });
  expect(
    destinationQuerySchema.parse({
      page: '2',
      pageSize: '24',
      region: 'gilgit-baltistan',
      interest: 'nature',
      season: 'summer',
    }),
  ).toMatchObject({ page: 2, pageSize: 24 });
});
test.each([
  { page: '1e2' },
  { page: '-1' },
  { pageSize: 100 },
  { page: ['1', '2'] },
  { season: 'unknown' },
  { interest: 'Nature' },
  { secret: 'x' },
  { locale: '../../' },
])('rejects malformed or unbounded destination inputs %j', (input) => {
  expect(() => destinationQuerySchema.parse(input)).toThrow();
});
