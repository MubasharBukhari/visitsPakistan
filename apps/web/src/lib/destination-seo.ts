import type { DestinationDetail } from '@visitspakistan/domain';
export const siteUrl = () => process.env.SITE_URL ?? 'http://localhost:3000';
export const absoluteUrl = (path: string) => new URL(path, siteUrl()).href;
export const destinationPath = (slug: string, locale = 'en') =>
  `/destinations/${encodeURIComponent(slug)}/${locale === 'en' ? '' : `?locale=${encodeURIComponent(locale)}`}`;
export const directoryPath = (locale = 'en') =>
  `/destinations/${locale === 'en' ? '' : `?locale=${encodeURIComponent(locale)}`}`;
export const jsonLd = (data: unknown) =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
export function destinationStructuredData(d: DestinationDetail) {
  const url = absoluteUrl(
    destinationPath(d.canonical.slug, d.canonical.locale),
  );
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'TouristDestination',
      '@id': `${url}#destination`,
      identifier: d.canonical.id,
      name: d.canonical.name,
      url,
      ...(d.editorial?.summary ? { description: d.editorial.summary } : {}),
      ...(d.editorial?.heroMedia
        ? {
            image: absoluteUrl(`/editorial-media/${d.editorial.heroMedia.id}/`),
          }
        : {}),
      ...(d.canonical.coordinates
        ? { geo: { '@type': 'GeoCoordinates', ...d.canonical.coordinates } }
        : {}),
      ...(d.region
        ? { containedInPlace: { '@type': 'Place', name: d.region.name } }
        : {}),
      ...(d.attractions.length
        ? {
            includesAttraction: d.attractions.map((a) => ({
              '@type': 'TouristAttraction',
              name: a.name,
              identifier: a.id,
            })),
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: 'Home', item: absoluteUrl('/') },
        {
          name: 'Destinations',
          item: absoluteUrl(directoryPath(d.canonical.locale)),
        },
        { name: d.canonical.name, item: url },
      ].map((v, i) => ({ '@type': 'ListItem', position: i + 1, ...v })),
    },
  ];
}
export const humanTag = (tag: string) =>
  tag.replaceAll('-', ' ').replace(/^./, (c) => c.toUpperCase());
export const verifiedDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
export function safeSourceUrl(value: string | null) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
