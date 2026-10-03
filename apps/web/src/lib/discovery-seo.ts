import type { Metadata } from 'next';
import type { DiscoveryDetail, DiscoveryLink } from '@visitspakistan/domain';
import { absoluteUrl } from './destination-seo';
export const entityPath = (
  e: Pick<DiscoveryLink, 'kind' | 'slug' | 'locale'>,
) =>
  `/${e.kind === 'PLACE' ? 'places' : e.kind === 'EXPERIENCE' ? 'experiences' : 'destinations'}/${encodeURIComponent(e.slug)}/${e.locale === 'en' ? '' : `?locale=${encodeURIComponent(e.locale)}`}`;
export function discoveryMetadata(d: DiscoveryDetail | null): Metadata {
  if (!d)
    return {
      title: 'Place or experience not found | VisitsPakistan',
      robots: { index: false, follow: false },
    };
  const title = d.editorial?.seoTitle || `${d.canonical.name} | VisitsPakistan`;
  const description =
    d.editorial?.metaDescription ||
    d.canonical.summary ||
    `Explore ${d.canonical.name} through sourced knowledge and connected places.`;
  const url = absoluteUrl(entityPath(d.canonical));
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      ...(d.editorial?.heroMedia
        ? {
            images: [
              {
                url: absoluteUrl(
                  `/editorial-media/${d.editorial.heroMedia.id}/`,
                ),
                alt: d.editorial.heroMedia.alt,
                width: d.editorial.heroMedia.width,
                height: d.editorial.heroMedia.height,
              },
            ],
          }
        : {}),
    },
  };
}
export function discoveryBreadcrumbs(d: DiscoveryDetail) {
  const dest = d.canonical.kind === 'PLACE' ? d.destinations[0] : undefined;
  return [
    { name: 'Home', path: '/' },
    ...(dest
      ? [
          { name: 'Destinations', path: '/destinations/' },
          { name: dest.name, path: entityPath(dest) },
        ]
      : [{ name: 'Things to do', path: '/things-to-do/' }]),
    { name: d.canonical.name, path: entityPath(d.canonical) },
  ];
}
export function discoveryStructuredData(d: DiscoveryDetail) {
  const c = d.canonical,
    url = absoluteUrl(entityPath(c));
  return [
    {
      '@context': 'https://schema.org',
      '@type': c.kind === 'PLACE' ? 'TouristAttraction' : 'Thing',
      '@id': `${url}#entity`,
      identifier: c.id,
      name: c.name,
      url,
      ...(c.summary || d.editorial?.summary
        ? { description: c.summary || d.editorial?.summary }
        : {}),
      ...(c.coordinates
        ? { geo: { '@type': 'GeoCoordinates', ...c.coordinates } }
        : {}),
      ...(c.kind === 'PLACE' && d.geography
        ? { containedInPlace: { '@type': 'Place', name: d.geography.name } }
        : {}),
      ...(d.editorial?.heroMedia
        ? {
            image: absoluteUrl(`/editorial-media/${d.editorial.heroMedia.id}/`),
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: discoveryBreadcrumbs(d).map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: absoluteUrl(b.path),
      })),
    },
  ];
}
