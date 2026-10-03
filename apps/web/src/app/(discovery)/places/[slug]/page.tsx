import { notFound } from 'next/navigation';
import { getDiscovery } from '../../../../lib/discovery-api';
import { discoveryMetadata } from '../../../../lib/discovery-seo';
import DiscoveryDetail from '../../../../components/discovery-detail';
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const locale = (q: Record<string, string | string[] | undefined>) =>
  typeof q.locale === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(q.locale)
    ? q.locale
    : 'en';
export async function generateMetadata({ params, searchParams }: Props) {
  return discoveryMetadata(
    await getDiscovery(
      'PLACE',
      (await params).slug,
      locale(await searchParams),
    ),
  );
}
export default async function Page({ params, searchParams }: Props) {
  const d = await getDiscovery(
    'PLACE',
    (await params).slug,
    locale(await searchParams),
  );
  if (!d) notFound();
  return <DiscoveryDetail detail={d} />;
}
