import { z } from 'zod';
export const editorialTypes = [
  'DESTINATION_EDITORIAL',
  'ATTRACTION_EDITORIAL',
  'TRAVEL_GUIDE',
  'FOOD_GUIDE',
  'ROUTE_GUIDE',
  'ITINERARY_EDITORIAL',
  'COLLECTION',
  'TRAVEL_STORY',
] as const;
export type EditorialType = (typeof editorialTypes)[number];
export const typeLabels: Record<EditorialType, string> = {
  DESTINATION_EDITORIAL: 'Destination editorial',
  ATTRACTION_EDITORIAL: 'Attraction editorial',
  TRAVEL_GUIDE: 'Travel guide',
  FOOD_GUIDE: 'Food guide',
  ROUTE_GUIDE: 'Route guide',
  ITINERARY_EDITORIAL: 'Itinerary editorial',
  COLLECTION: 'Collection',
  TRAVEL_STORY: 'Travel story',
};
const text = z.string().trim().min(1).max(10000);
const uuid = z.uuid();
export const blockSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('heading'),
      text: text,
      level: z.union([z.literal(2), z.literal(3)]),
    })
    .strict(),
  z.object({ type: z.literal('paragraph'), text: text }).strict(),
  z
    .object({ type: z.literal('list'), items: z.array(text).min(1).max(30) })
    .strict(),
  z
    .object({
      type: z.literal('callout'),
      text: text,
      tone: z.enum(['info', 'note']),
    })
    .strict(),
  z
    .object({
      type: z.literal('quote'),
      text: text,
      attribution: z.string().trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      type: z.literal('image'),
      mediaId: uuid,
      caption: z.string().max(300),
    })
    .strict(),
  z
    .object({
      type: z.literal('entity_reference'),
      entityId: uuid,
      label: z.string().trim().min(1).max(180),
    })
    .strict(),
]);
export type ContentBlock = z.infer<typeof blockSchema>;
export const blockTypes = [
  'heading',
  'paragraph',
  'list',
  'callout',
  'quote',
  'image',
  'entity_reference',
] as const;
export const editorialBodySchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    summary: z.string().max(400),
    seoTitle: z.string().max(70),
    metaDescription: z.string().max(180),
    blocks: z.array(blockSchema).max(100),
    sourceIds: z.array(uuid).max(30),
    canonicalIds: z.array(uuid).max(40),
    heroMediaId: uuid.nullable(),
    lastVerified: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.lastVerified && new Date(data.lastVerified).getTime() > Date.now())
      ctx.addIssue({
        code: 'custom',
        message: 'Verification cannot be in the future',
        path: ['lastVerified'],
      });
  });
export type EditorialBody = z.infer<typeof editorialBodySchema>;
export const createEditorialSchema = z
  .object({
    type: z.enum(editorialTypes),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .default('en'),
    primaryEntityId: uuid.nullable(),
    body: editorialBodySchema,
  })
  .strict();
export type EditorialStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';
export type CmsRole = 'CONTRIBUTOR' | 'EDITOR' | 'ADMINISTRATOR';
export interface CmsActor {
  id: string;
  roles: CmsRole[];
  displayName: string;
}
export class EditorialError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireRole(actor: CmsActor, role: CmsRole) {
  if (!actor.roles.includes(role))
    throw new EditorialError(403, 'Permission denied');
}
export function canEdit(actor: CmsActor, authorId: string) {
  return (
    actor.roles.includes('EDITOR') ||
    (actor.roles.includes('CONTRIBUTOR') && actor.id === authorId)
  );
}
export function assertTransition(
  status: EditorialStatus,
  action: 'submit' | 'approve' | 'publish' | 'return',
  actor: CmsActor,
  authorId: string,
) {
  if (action === 'submit') {
    if (status !== 'DRAFT' || !canEdit(actor, authorId))
      throw new EditorialError(403, 'Only an editable draft can be submitted');
    return 'REVIEW' as const;
  }
  requireRole(actor, 'EDITOR');
  if (action === 'approve') {
    if (status !== 'REVIEW' || actor.id === authorId)
      throw new EditorialError(
        403,
        'A different editor must review the submitted revision',
      );
    return 'APPROVED' as const;
  }
  if (action === 'publish') {
    if (status !== 'APPROVED')
      throw new EditorialError(409, 'Approve the revision before publishing');
    return 'PUBLISHED' as const;
  }
  if (status !== 'REVIEW' && status !== 'APPROVED')
    throw new EditorialError(
      409,
      'Only reviewed work can be returned to draft',
    );
  return 'DRAFT' as const;
}
export function readyForReview(body: EditorialBody) {
  if (
    !body.blocks.length ||
    !body.sourceIds.length ||
    !body.seoTitle.trim() ||
    body.metaDescription.trim().length < 50
  )
    throw new EditorialError(
      422,
      'Add content blocks, sources and complete SEO metadata before review',
    );
}
export function referenceIds(body: EditorialBody, primary: string | null) {
  return [
    ...new Set([
      ...(primary ? [primary] : []),
      ...body.canonicalIds,
      ...body.blocks.flatMap((b) =>
        b.type === 'entity_reference' ? [b.entityId] : [],
      ),
    ]),
  ];
}
export function mediaIds(body: EditorialBody) {
  return [
    ...new Set([
      ...(body.heroMediaId ? [body.heroMediaId] : []),
      ...body.blocks.flatMap((b) => (b.type === 'image' ? [b.mediaId] : [])),
    ]),
  ];
}
export const themeTokensSchema = z
  .object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    tertiary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    neutral: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    headingFont: z.enum(['Playfair Display', 'Plus Jakarta Sans']),
    bodyFont: z.literal('Plus Jakarta Sans'),
    radius: z.number().int().min(0).max(24),
    contentWidth: z.number().int().min(960).max(1440),
  })
  .strict();
export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export const brandTokens: ThemeTokens = {
  primary: '#0D5C3A',
  secondary: '#D97736',
  tertiary: '#0284C7',
  neutral: '#0F172A',
  headingFont: 'Playfair Display',
  bodyFont: 'Plus Jakarta Sans',
  radius: 12,
  contentWidth: 1200,
};
function luminance(hex: string) {
  const v = hex
    .slice(1)
    .match(/../g)!
    .map((n) => parseInt(n, 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  return v[0]! * 0.2126 + v[1]! * 0.7152 + v[2]! * 0.0722;
}
export function validateTheme(tokens: ThemeTokens) {
  if (
    1.05 / (luminance(tokens.primary) + 0.05) < 4.5 ||
    1.05 / (luminance(tokens.neutral) + 0.05) < 4.5
  )
    throw new EditorialError(
      422,
      'Primary buttons and neutral text must meet 4.5:1 contrast on white',
    );
}
