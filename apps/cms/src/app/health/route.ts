export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(
    { status: 'ok', service: 'cms' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
