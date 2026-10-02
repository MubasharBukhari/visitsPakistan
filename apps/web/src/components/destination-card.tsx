import Image from 'next/image';
import { DestinationLink } from './destination-link';
import type { DestinationCard as Card } from '@visitspakistan/domain';
import { destinationPath, humanTag } from '../lib/destination-seo';
export function LandscapePlaceholder({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={`destination-landscape ${compact ? 'compact' : ''}`}
      aria-hidden="true"
    >
      <span />
      <i />
      <b />
      <small>Discover Pakistan</small>
    </div>
  );
}
export function DestinationCard({ destination: d }: { destination: Card }) {
  const image = d.editorial?.heroMedia;
  return (
    <article className="destination-card">
      <DestinationLink
        href={destinationPath(d.canonical.slug, d.canonical.locale)}
        className="destination-card-cover"
        ariaLabel={`Explore ${d.canonical.name}`}
      >
        {image ? (
          <Image
            src={`/editorial-media/${image.id}/`}
            alt={image.alt}
            width={image.width}
            height={image.height}
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
          />
        ) : (
          <LandscapePlaceholder compact />
        )}
        <span className="destination-region">
          {d.region?.name ?? 'Pakistan'}
        </span>
      </DestinationLink>
      <div className="destination-card-copy">
        <div className="destination-card-kicker">
          {d.interests.slice(0, 2).map(humanTag).join(' · ') ||
            'Destination discovery'}
        </div>
        <h2>
          <DestinationLink
            href={destinationPath(d.canonical.slug, d.canonical.locale)}
          >
            {d.canonical.name}
            <span aria-hidden="true">↗</span>
          </DestinationLink>
        </h2>
        {d.editorial?.summary && <p>{d.editorial.summary}</p>}
        <DestinationLink
          className="destination-text-link"
          href={destinationPath(d.canonical.slug, d.canonical.locale)}
        >
          Explore destination <span aria-hidden="true">→</span>
        </DestinationLink>
      </div>
    </article>
  );
}
