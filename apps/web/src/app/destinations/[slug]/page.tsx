import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type {
  ContentBlock,
  DestinationEditorial,
  PublicEntity,
} from '@visitspakistan/domain';
import { getDestination } from '../../../lib/destination-api';
import {
  absoluteUrl,
  destinationPath,
  directoryPath,
  destinationStructuredData,
  jsonLd,
  humanTag,
  verifiedDate,
  safeSourceUrl,
} from '../../../lib/destination-seo';
import { LandscapePlaceholder } from '../../../components/destination-card';
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
function getLocale(raw: Record<string, string | string[] | undefined>) {
  return typeof raw.locale === 'string' &&
    /^[a-z]{2}(-[A-Z]{2})?$/.test(raw.locale)
    ? raw.locale
    : 'en';
}
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDestination(slug, getLocale(await searchParams));
  if (!d)
    return {
      title: 'Destination not found | VisitsPakistan',
      robots: { index: false, follow: false },
    };
  const canonical = absoluteUrl(
    destinationPath(d.canonical.slug, d.canonical.locale),
  );
  const e = d.editorial;
  const title =
    e?.seoTitle ??
    `${d.canonical.name} | Destinations in Pakistan | VisitsPakistan`;
  const description =
    e?.metaDescription ??
    `Explore ${d.canonical.name} through verified destination knowledge, attractions and published travel guides.`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      ...(e?.heroMedia
        ? {
            images: [
              {
                url: absoluteUrl(`/editorial-media/${e.heroMedia.id}/`),
                alt: e.heroMedia.alt,
                width: e.heroMedia.width,
                height: e.heroMedia.height,
              },
            ],
          }
        : {}),
    },
  };
}
export default async function Detail({ params, searchParams }: Props) {
  const { slug } = await params;
  const d = await getDestination(slug, getLocale(await searchParams));
  if (!d) notFound();
  const e = d.editorial;
  return (
    <main id="destination-main" className="destination-detail">
      <nav className="destination-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href={directoryPath(d.canonical.locale)}>Destinations</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{d.canonical.name}</span>
      </nav>
      <section className="destination-detail-title">
        <div>
          <span className="destination-eyebrow">
            {d.region?.name ?? 'Explore Pakistan'}
          </span>
          <h1>{d.canonical.name}</h1>
          {e?.summary && <p>{e.summary}</p>}
          <div className="destination-detail-tags">
            {d.interests.map((t) => (
              <Link
                key={t}
                href={`/destinations/?interest=${encodeURIComponent(t)}&locale=${d.canonical.locale}`}
              >
                {humanTag(t)}
              </Link>
            ))}
          </div>
        </div>
        <div className="destination-verification">
          <span aria-hidden="true">✓</span>
          <div>
            Knowledge last verified
            <strong>{verifiedDate(d.last_verified)}</strong>
            <a href="#destination-sources">View sources ↗</a>
          </div>
        </div>
      </section>
      <figure className="destination-detail-hero">
        {e?.heroMedia ? (
          <Image
            src={`/editorial-media/${e.heroMedia.id}/`}
            alt={e.heroMedia.alt}
            width={e.heroMedia.width}
            height={e.heroMedia.height}
            priority
            unoptimized
            sizes="(max-width: 1200px) 100vw, 1200px"
          />
        ) : (
          <LandscapePlaceholder />
        )}
        {e?.heroMedia && <figcaption>{e.heroMedia.credit}</figcaption>}
      </figure>
      <nav
        className="destination-section-links"
        aria-label="On this destination page"
      >
        {e && <a href="#destination-story">Overview</a>}
        {d.attractions.length > 0 && (
          <a href="#destination-attractions">Attractions</a>
        )}
        {d.experiences.length > 0 && (
          <a href="#destination-experiences">Experiences</a>
        )}
        {d.food.length > 0 && <a href="#destination-food">Food</a>}
        {d.guides.length > 0 && <a href="#destination-guides">Travel guides</a>}
        <a href="#destination-facts">At a glance</a>
        <a href="#destination-sources">Sources</a>
      </nav>
      <div className="destination-detail-columns">
        <div>
          {e ? (
            <article id="destination-story" className="destination-prose">
              <span className="destination-eyebrow">The destination story</span>
              <h2>{e.title}</h2>
              <p className="destination-byline">
                By {e.author.displayName}
                {e.reviewer && <> · Reviewed by {e.reviewer.displayName}</>}
                {e.lastVerified && (
                  <> · Editorial verified {verifiedDate(e.lastVerified)}</>
                )}
              </p>
              {e.blocks.map((b, i) => (
                <EditorialBlock
                  key={i}
                  block={b}
                  editorial={e}
                  locale={d.canonical.locale}
                />
              ))}
              <Link
                className="destination-text-link"
                href={`/content/${e.slug}/`}
              >
                Read the complete editorial →
              </Link>
            </article>
          ) : (
            <section className="destination-prose">
              <h2>Start with what we know.</h2>
              <p>
                Explore the verified places and sources connected to{' '}
                {d.canonical.name}. A destination story will appear here when it
                is published.
              </p>
            </section>
          )}
          <EntitySection
            id="destination-attractions"
            title="Places that draw you in"
            eyebrow="Attractions"
            entities={d.attractions}
          />
          <EntitySection
            id="destination-experiences"
            title="Discover a different perspective"
            eyebrow="Experiences"
            entities={d.experiences}
          />
          <EntitySection
            id="destination-food"
            title="A taste of the destination"
            eyebrow="Food & local places"
            entities={d.food}
          />
          {d.guides.length > 0 && (
            <section id="destination-guides" className="destination-related">
              <span className="destination-eyebrow">Keep exploring</span>
              <h2>Stories for the journey.</h2>
              <div className="destination-guide-list">
                {d.guides.map((g) => (
                  <Link key={g.id} href={`/content/${g.slug}/`}>
                    <span>
                      {humanTag(g.type.toLowerCase().replaceAll('_', '-'))}
                    </span>
                    <h3>
                      {g.title} <span aria-hidden="true">↗</span>
                    </h3>
                    {g.summary && <p>{g.summary}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside id="destination-facts" className="destination-facts">
          <span className="destination-eyebrow">At a glance</span>
          <h2>{d.canonical.name}</h2>
          <dl>
            {d.region && (
              <>
                <dt>Region</dt>
                <dd>
                  <Link
                    href={`/destinations/?region=${encodeURIComponent(d.region.slug)}&locale=${d.canonical.locale}`}
                  >
                    {d.region.name} ↗
                  </Link>
                </dd>
              </>
            )}
            <dt>Time zone</dt>
            <dd>{d.canonical.timezone}</dd>
            {d.seasons.length > 0 && (
              <>
                <dt>Season tags</dt>
                <dd>{d.seasons.map(humanTag).join(' · ')}</dd>
              </>
            )}
            {d.canonical.coordinates && (
              <>
                <dt>Geographic reference</dt>
                <dd>
                  {d.canonical.coordinates.latitude.toFixed(4)}°,{' '}
                  {d.canonical.coordinates.longitude.toFixed(4)}°
                </dd>
              </>
            )}
            <dt>Knowledge last verified</dt>
            <dd>{verifiedDate(d.last_verified)}</dd>
          </dl>
          <p>
            Season tags describe reviewed destination information. Check current
            conditions and access before traveling.
          </p>
          <Link href={directoryPath(d.canonical.locale)}>
            Explore more destinations →
          </Link>
        </aside>
      </div>
      <section id="destination-sources" className="destination-sources">
        <div>
          <span className="destination-eyebrow">Knowledge you can trace</span>
          <h2>Sources & verification.</h2>
          <p>
            Canonical destination knowledge last verified{' '}
            {verifiedDate(d.last_verified)}.
            {e?.lastUpdated && (
              <> Editorial updated {verifiedDate(e.lastUpdated)}.</>
            )}
          </p>
        </div>
        <ul>
          {d.sources.map((s) => {
            const href = safeSourceUrl(s.url);
            return (
              <li key={s.id}>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    {s.title} ↗
                  </a>
                ) : (
                  <strong>{s.title}</strong>
                )}
                <span>
                  {s.publisher} · Accessed {verifiedDate(s.accessed_at)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(destinationStructuredData(d)),
        }}
      />
    </main>
  );
}
function EntitySection({
  id,
  title,
  eyebrow,
  entities,
}: {
  id: string;
  title: string;
  eyebrow: string;
  entities: PublicEntity[];
}) {
  if (!entities.length) return null;
  return (
    <section id={id} className="destination-related">
      <span className="destination-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <ul className="destination-entity-grid">
        {entities.map((e) => (
          <li key={e.id}>
            <span aria-hidden="true">↗</span>
            <h3>{e.name}</h3>
            <p>Verified {verifiedDate(e.last_verified)}</p>
            {e.sources[0] && safeSourceUrl(e.sources[0].url) && (
              <a
                href={safeSourceUrl(e.sources[0].url)!}
                target="_blank"
                rel="noreferrer"
              >
                Source: {e.sources[0].publisher} ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
function EditorialBlock({
  block: b,
  editorial: e,
  locale,
}: {
  block: ContentBlock;
  editorial: DestinationEditorial;
  locale: string;
}) {
  if (b.type === 'heading')
    return b.level === 2 ? <h2>{b.text}</h2> : <h3>{b.text}</h3>;
  if (b.type === 'paragraph') return <p>{b.text}</p>;
  if (b.type === 'list')
    return (
      <ul>
        {b.items.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    );
  if (b.type === 'callout')
    return <aside className="destination-story-note">{b.text}</aside>;
  if (b.type === 'quote')
    return (
      <blockquote>
        {b.text}
        <cite>{b.attribution}</cite>
      </blockquote>
    );
  if (b.type === 'entity_reference') {
    const entity = e.canonicalEntities.find((x) => x.id === b.entityId);
    return (
      <aside className="destination-story-reference">
        <strong>{b.label}</strong>
        {entity && <span>{entity.name}</span>}
        <Link href={directoryPath(locale)}>
          Explore destination knowledge →
        </Link>
      </aside>
    );
  }
  const image = e.media.find((m) => m.id === b.mediaId);
  return image ? (
    <figure>
      <Image
        src={`/editorial-media/${image.id}/`}
        alt={image.alt}
        width={image.width}
        height={image.height}
        unoptimized
      />
      <figcaption>
        {b.caption} · {image.credit}
      </figcaption>
    </figure>
  ) : null;
}
