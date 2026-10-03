import { cache } from 'react';
import type {
  DiscoveryDetail,
  ThingsDirectory,
  ThingsQuery,
} from '@visitspakistan/domain';
import { DestinationApiError } from './destination-api';
async function read<T>(path: string): Promise<T | null> {
  const r = await fetch(
    `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/api/v1/${path}`,
    { cache: 'no-store', signal: AbortSignal.timeout(8000) },
  );
  if (r.status === 404) return null;
  if (!r.ok) throw new DestinationApiError(r.status);
  return r.json();
}
export const getDiscovery = cache(
  async (kind: 'PLACE' | 'EXPERIENCE', slug: string, locale = 'en') => {
    if (slug.length > 200 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      return null;
    return read<DiscoveryDetail>(
      `${kind === 'PLACE' ? 'places' : 'experiences'}/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
    );
  },
);
export async function getThings(q: ThingsQuery): Promise<ThingsDirectory> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q))
    if (v !== undefined) params.set(k, String(v));
  const r = await read<ThingsDirectory>(`things-to-do?${params}`);
  if (!r) throw new DestinationApiError(503);
  return r;
}
