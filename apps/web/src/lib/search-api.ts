import type { SearchQuery, SearchResponse } from '@visitspakistan/domain';
export async function getSearch(q: SearchQuery): Promise<SearchResponse> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q))
    if (v !== undefined) p.set(k, String(v));
  const r = await fetch(
    `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/api/v1/search?${p}`,
    { cache: 'no-store', signal: AbortSignal.timeout(10000) },
  );
  if (!r.ok) throw new Error('Search temporarily unavailable');
  return r.json();
}
