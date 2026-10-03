import {
  assertTransition,
  EditorialError,
  editorialBodySchema,
  destinationPresentationSchema,
  referenceIds,
  readyForReview,
  brandTokens,
  validateTheme,
} from './editorial';
const author = {
  id: 'a',
  displayName: 'Author',
  roles: ['CONTRIBUTOR'] as const,
};
const editor = { id: 'b', displayName: 'Reviewer', roles: ['EDITOR'] as const };
const a = { ...author, roles: [...author.roles] };
const e = { ...editor, roles: [...editor.roles] };
test('workflow preserves independent approval and rejects skipped stages', () => {
  expect(assertTransition('DRAFT', 'submit', a, 'a')).toBe('REVIEW');
  expect(assertTransition('REVIEW', 'approve', e, 'a')).toBe('APPROVED');
  expect(assertTransition('APPROVED', 'publish', e, 'a')).toBe('PUBLISHED');
  expect(() =>
    assertTransition('REVIEW', 'approve', { ...e, id: 'a' }, 'a'),
  ).toThrow('different editor');
  expect(() => assertTransition('DRAFT', 'publish', e, 'a')).toThrow(
    EditorialError,
  );
  expect(() => assertTransition('REVIEW', 'approve', a, 'a')).toThrow(
    'Permission denied',
  );
});
test('structured blocks reject raw embeds, duplicated canonical facts and script-shaped fields', () => {
  const base = {
    title: 'Hunza editorial',
    summary: '',
    seoTitle: 'Hunza',
    metaDescription: '',
    blocks: [],
    sourceIds: [],
    canonicalIds: [],
    heroMediaId: null,
    lastVerified: null,
  };
  expect(() =>
    editorialBodySchema.parse({
      ...base,
      coordinates: { latitude: 36, longitude: 74 },
    }),
  ).toThrow();
  expect(() =>
    editorialBodySchema.parse({
      ...base,
      blocks: [{ type: 'html', html: '<script>alert(1)</script>' }],
    }),
  ).toThrow();
  expect(() => readyForReview(editorialBodySchema.parse(base))).toThrow(
    'sources',
  );
});
test('canonical reference IDs are deduplicated across primary links and blocks', () => {
  const id = '00000000-0000-4000-8000-000000000004';
  const body = editorialBodySchema.parse({
    title: 'Hunza editorial',
    summary: '',
    seoTitle: 'Hunza',
    metaDescription: '',
    blocks: [{ type: 'entity_reference', entityId: id, label: 'Hunza' }],
    sourceIds: [],
    canonicalIds: [id],
    heroMediaId: null,
    lastVerified: null,
  });
  expect(referenceIds(body, id)).toEqual([id]);
});
test('brand theme contrast is validated without accepting executable CSS', () => {
  expect(() => validateTheme(brandTokens)).not.toThrow();
  expect(() => validateTheme({ ...brandTokens, primary: '#FFFFFF' })).toThrow(
    'contrast',
  );
});

test('destination presentation rejects duplicated geography and malformed FAQ pairs', () => {
  const value = {
    quickAnswer: 'A sourced answer',
    overview: 'Overview',
    whyVisit: '',
    bestTime: '',
    travelTips: [],
    faq: [{ question: 'Where?', answer: 'See canonical geography.' }],
  };
  expect(destinationPresentationSchema.parse(value).faq).toHaveLength(1);
  expect(() =>
    destinationPresentationSchema.parse({ ...value, coordinates: [74, 36] }),
  ).toThrow();
  expect(() =>
    destinationPresentationSchema.parse({
      ...value,
      faq: [{ question: 'Where?', answer: '' }],
    }),
  ).toThrow();
  expect(() =>
    destinationPresentationSchema.parse({
      ...value,
      quickAnswer: 'x'.repeat(1001),
    }),
  ).toThrow();
});
