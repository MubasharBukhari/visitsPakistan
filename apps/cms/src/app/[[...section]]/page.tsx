import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CmsApp } from '../../components/cms-app';
import type { CmsActor } from '@visitspakistan/domain';
export default async function Studio({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const token = (await cookies()).get('vp_staff')?.value;
  if (!token) redirect('/login/');
  let actor: CmsActor | null = null;
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000'}/api/v1/admin/auth/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.ok) actor = await response.json();
  } catch {
    /* login can report infrastructure errors */
  }
  if (!actor) redirect('/login/');
  return <CmsApp actor={actor} section={(await params).section ?? []} />;
}
