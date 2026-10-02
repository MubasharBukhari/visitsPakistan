import { cache } from 'react';
import type {
  DestinationDetail,
  DestinationDirectory,
  DestinationQuery,
} from '@visitspakistan/domain';
export class DestinationApiError extends Error {
  constructor(public readonly status: number) {
    super('Destination information is temporarily unavailable');
  }
}
async function read<T>(path: string): Promise<T | null> {
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/v1/destinations${path}`,
    { cache: 'no-store', signal: AbortSignal.timeout(8000) },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new DestinationApiError(response.status);
  return response.json();
}
export const getDestination = cache(async (slug: string, locale = 'en') => {
  if (slug.length > 200 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  return read<DestinationDetail>(
    `/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
  );
});
export async function getDestinations(
  q: DestinationQuery,
): Promise<DestinationDirectory> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q))
    if (value !== undefined) params.set(key, String(value));
  const result = await read<DestinationDirectory>(`?${params}`);
  if (!result) throw new DestinationApiError(503);
  return result;
}
