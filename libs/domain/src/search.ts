import { z } from 'zod';
export const searchTypes = ['DESTINATION', 'PLACE', 'EXPERIENCE'] as const;
export type SearchType = (typeof searchTypes)[number];
export const searchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((v) => Array.from(v).every((c) => c.charCodeAt(0) > 31)),
    type: z.enum(searchTypes).optional(),
    destination: z
      .string()
      .max(200)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .optional(),
    page: z.coerce.number().int().min(1).max(100).default(1),
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .default('en'),
    autocomplete: z
      .preprocess(
        (v) => (v === 'true' ? true : v === 'false' ? false : v),
        z.boolean(),
      )
      .default(false),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
  })
  .strict()
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), {
    message: 'Supply both geographic coordinates',
  });
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export interface SearchDocument {
  id: string;
  type: SearchType;
  locale: string;
  name: string;
  alternative_names: string[];
  summary: string | null;
  category: string | null;
  tags: string[];
  destination_slugs: string[];
  context_names: string[];
  family_suitable: boolean | null;
  location: { lat: number; lon: number } | null;
  slug: string;
  last_verified: string;
}
export interface SearchResult extends SearchDocument {
  url: string;
}
export interface SearchResponse {
  query: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  groups: Array<{ type: SearchType; total: number; results: SearchResult[] }>;
  suggestions: Array<{ name: string; url: string; type: SearchType }>;
}
