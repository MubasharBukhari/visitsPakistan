export const dynamic = 'force-dynamic';
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id))
    return new Response('Not found', { status: 404 });
  try {
    const res = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/api/v1/media/${id}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok)
      return new Response('Not found', {
        status: res.status === 404 ? 404 : 503,
      });
    return new Response(await res.arrayBuffer(), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Media unavailable', { status: 503 });
  }
}
