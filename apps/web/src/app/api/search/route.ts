import { searchQuerySchema } from '@visitspakistan/domain';
import { getSearch } from '../../../lib/search-api';
export async function GET(request: Request) {
  const q = searchQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!q.success)
    return Response.json({ error: 'Invalid search query' }, { status: 422 });
  try {
    return Response.json(await getSearch(q.data), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { error: 'Search temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
