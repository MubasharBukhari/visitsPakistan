import type { MetadataRoute } from 'next';
import { getDestinations } from '../lib/destination-api';
import { getThings } from '../lib/discovery-api';
import { absoluteUrl, destinationPath } from '../lib/destination-seo';
import { entityPath } from '../lib/discovery-seo';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const first = await getDestinations({ page: 1, pageSize: 48, locale: 'en' });
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/') },
    { url: absoluteUrl('/destinations/') },
    { url: absoluteUrl('/things-to-do/') },
  ];
  const append = (data: typeof first.data) => {
    for (const d of data)
      entries.push({
        url: absoluteUrl(destinationPath(d.canonical.slug, d.canonical.locale)),
        lastModified: updated(d),
      });
  };
  if (first.pagination.total > 49997)
    throw new Error(
      'Public sitemap requires sharding before exceeding 50000 URLs',
    );
  append(first.data);
  for (let page = 2; page <= first.pagination.totalPages; page++)
    append((await getDestinations({ page, pageSize: 48, locale: 'en' })).data);
  const things = await getThings({ page: 1, pageSize: 48, locale: 'en' });
  if (first.pagination.total + things.pagination.total > 49997)
    throw new Error(
      'Public sitemap requires sharding before exceeding 50000 URLs',
    );
  const appendThings = (data: typeof things.data) => {
    for (const d of data)
      entries.push({
        url: absoluteUrl(entityPath(d.canonical)),
        lastModified: updated(d),
      });
  };
  appendThings(things.data);
  for (let page = 2; page <= things.pagination.totalPages; page++)
    appendThings((await getThings({ page, pageSize: 48, locale: 'en' })).data);
  if (entries.length > 50000)
    throw new Error('Public sitemap requires sharding');
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}
function updated(d: {
  canonical: { updated_at: string };
  editorial: { lastUpdated: string } | null;
}) {
  return new Date(
    Math.max(
      new Date(d.canonical.updated_at).getTime(),
      d.editorial ? new Date(d.editorial.lastUpdated).getTime() : 0,
    ),
  );
}
