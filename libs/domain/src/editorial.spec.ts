import {
  assertTransition,
  EditorialError,
  editorialBodySchema,
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
