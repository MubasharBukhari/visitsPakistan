import { thingsQuerySchema } from './discovery';
test('discovery filters normalize category and preserve explicit false family suitability', () => {
  expect(
    thingsQuerySchema.parse({
      category: 'HERITAGE_TOUR',
      familySuitable: 'false',
      duration: '90',
      destination: 'hunza',
    }),
  ).toMatchObject({
    category: 'heritage-tour',
    familySuitable: false,
    duration: 90,
    destination: 'hunza',
    locale: 'en',
    page: 1,
  });
});
test.each([
  { duration: '0' },
  { duration: '10081' },
  { familySuitable: 'yes' },
  { pageSize: '49' },
  { destination: '../private' },
  { kind: 'product' },
  { season: 'monsoon' },
  { unknown: 'true' },
])('rejects unsupported or unbounded discovery input %j', (input) => {
  expect(thingsQuerySchema.safeParse(input).success).toBe(false);
});
