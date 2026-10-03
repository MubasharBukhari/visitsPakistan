import { z } from 'zod';
import { destinationQuerySchema } from './destinations';
import type {
  DestinationEditorial,
  PublicEntity,
  PublicSource,
} from './destinations';
import type { PlaceType } from './knowledge-graph';
export const thingsQuerySchema = destinationQuerySchema
  .pick({ page: true, pageSize: true, locale: true, season: true })
  .extend({
    destination: z
      .string()
      .max(200)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .optional(),
    category: z
      .string()
      .max(80)
      .regex(/^[a-zA-Z0-9]+([-_][a-zA-Z0-9]+)*$/)
      .transform((v) => v.toLowerCase().replaceAll('_', '-'))
      .optional(),
    familySuitable: z
      .preprocess(
        (v) => (v === 'true' ? true : v === 'false' ? false : v),
        z.boolean(),
      )
      .optional(),
    duration: z
      .preprocess(
        (v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v),
        z.number().int().min(1).max(10080),
      )
      .optional(),
    kind: z.enum(['place', 'experience']).optional(),
  })
  .strict();
export type ThingsQuery = z.infer<typeof thingsQuerySchema>;
export interface DiscoveryLink extends PublicEntity {
  locale: string;
}
export interface DiscoveryCanonical extends DiscoveryLink {
  kind: 'PLACE' | 'EXPERIENCE';
  place_type: PlaceType | null;
  geo_entity_id: string | null;
  alt_names: string[];
  summary: string | null;
  category: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  opening_information: string | null;
  admission_information: string | null;
  duration_minutes: number | null;
  best_time: string | null;
  seasons: string[];
  family_suitable: boolean | null;
  accessibility: string | null;
  facilities: string[];
  difficulty: string | null;
  status: 'PUBLISHED';
  created_at: string;
  updated_at: string;
}
export interface DiscoveryCard {
  canonical: DiscoveryCanonical;
  editorial: DestinationEditorial | null;
  destinations: DiscoveryLink[];
  sources: PublicSource[];
  last_verified: string;
}
export interface DiscoveryDetail extends DiscoveryCard {
  geography: DiscoveryLink | null;
  places: DiscoveryLink[];
  experiences: DiscoveryLink[];
  nearby: Array<DiscoveryLink & { distance_meters: number | null }>;
}
export interface ThingsDirectory {
  data: DiscoveryCard[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets: {
    destinations: Array<{ slug: string; name: string }>;
    categories: string[];
    seasons: string[];
  };
}
