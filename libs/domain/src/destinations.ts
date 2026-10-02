import { z } from 'zod';
import type { ContentBlock } from './editorial';
export const destinationSeasons = [
  'spring',
  'summer',
  'autumn',
  'winter',
  'all-year',
] as const;
const tag = z
  .string()
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const positiveInteger = (max: number, fallback: number) =>
  z.preprocess(
    (v) =>
      v === undefined
        ? fallback
        : typeof v === 'string' && /^\d+$/.test(v)
          ? Number(v)
          : v,
    z.number().int().min(1).max(max),
  );
export const destinationQuerySchema = z
  .object({
    region: z
      .string()
      .max(200)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .optional(),
    interest: tag.optional(),
    season: z.enum(destinationSeasons).optional(),
    page: positiveInteger(10000, 1),
    pageSize: positiveInteger(48, 12),
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .default('en'),
  })
  .strict();
export type DestinationQuery = z.infer<typeof destinationQuerySchema>;
export interface PublicSource {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  accessed_at: string;
}
export interface PublicEntity {
  id: string;
  kind: string;
  name: string;
  slug: string;
  last_verified: string;
  sources: PublicSource[];
}
export interface DestinationEditorial {
  id: string;
  type: string;
  slug: string;
  locale: string;
  title: string;
  summary: string;
  seoTitle: string;
  metaDescription: string;
  blocks: ContentBlock[];
  author: { displayName: string };
  reviewer: { displayName: string } | null;
  firstPublished: string | null;
  lastUpdated: string;
  lastVerified: string | null;
  heroMedia: PublicMedia | null;
  media: PublicMedia[];
  sources: PublicSource[];
  canonicalEntities: Array<{
    id: string;
    kind: string;
    name: string;
    slug: string;
  }>;
}
export interface PublicMedia {
  id: string;
  width: number;
  height: number;
  alt: string;
  credit: string;
}
export interface EditorialGuide {
  id: string;
  type: string;
  title: string;
  slug: string;
  summary: string;
}
export interface DestinationCard {
  canonical: PublicEntity & {
    type: 'CITY' | 'DESTINATION';
    locale: string;
    timezone: string;
    alt_names: string[];
    coordinates: { latitude: number; longitude: number } | null;
  };
  interests: string[];
  seasons: string[];
  region: PublicEntity | null;
  hierarchy: PublicEntity[];
  editorial: DestinationEditorial | null;
  sources: PublicSource[];
  last_verified: string;
}
export interface DestinationDetail extends DestinationCard {
  attractions: PublicEntity[];
  experiences: PublicEntity[];
  food: PublicEntity[];
  routes: PublicEntity[];
  itineraries: PublicEntity[];
  travel_products: PublicEntity[];
  guides: EditorialGuide[];
}
export interface DestinationDirectory {
  data: DestinationCard[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets: {
    regions: Array<{ slug: string; name: string }>;
    interests: string[];
    seasons: string[];
  };
}
