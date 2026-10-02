import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
const allowed =
  /^(auth\/(login|logout|me)|content(\/[0-9a-f-]{36}(\/actions)?)?|references|sources|themes|templates|presentation|media(\/[0-9a-f-]{36}\/content)?)$/;
async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const path = (await ctx.params).path.join('/');
  if (!allowed.test(path))
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (req.method !== 'GET' && req.headers.get('origin') !== req.nextUrl.origin)
    return NextResponse.json(
      { message: 'Invalid request origin' },
      { status: 403 },
    );
  const jar = await cookies();
  const token = jar.get('vp_staff')?.value;
  if (path !== 'auth/login' && !token)
    return NextResponse.json(
      { message: 'Staff sign-in required' },
      { status: 401 },
    );
  const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
  const target =
    path === 'presentation' && req.method === 'GET'
      ? `${api}/api/v1/presentation`
      : `${api}/api/v1/admin/${path}`;
  try {
    const type = req.headers.get('content-type');
    const body =
      req.method === 'GET' ? undefined : Buffer.from(await req.arrayBuffer());
    if (body && body.length > 9 * 1024 * 1024)
      return NextResponse.json(
        { message: 'Request too large' },
        { status: 413 },
      );
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(type ? { 'Content-Type': type } : {}),
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (path === 'auth/login') {
      const data = await upstream.json();
      const res = NextResponse.json(data.staff ? { staff: data.staff } : data, {
        status: upstream.status,
        headers: { 'Cache-Control': 'no-store' },
      });
      if (upstream.ok && data.token)
        res.cookies.set('vp_staff', data.token, {
          httpOnly: true,
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 12 * 60 * 60,
        });
      return res;
    }
    const res = new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    if (path === 'auth/logout' || upstream.status === 401)
      res.cookies.delete('vp_staff');
    return res;
  } catch {
    return NextResponse.json(
      { message: 'CMS API unavailable; retry shortly' },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
