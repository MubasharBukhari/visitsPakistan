export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const response = await fetch(
      new URL(
        '/ready',
        process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000',
      ),
      { cache: 'no-store', signal: AbortSignal.timeout(4000) },
    );
    if (!response.ok) throw new Error('Dependency unavailable');
    return Response.json(
      { status: 'ok', service: 'web' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { status: 'unavailable', service: 'web' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
