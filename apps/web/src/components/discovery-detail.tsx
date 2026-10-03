import Image from 'next/image';
import Link from 'next/link';
import type {
  DiscoveryDetail as Detail,
  DiscoveryLink,
  DestinationEditorial,
} from '@visitspakistan/domain';
import { LandscapePlaceholder } from './destination-card';
import {
  entityPath,
  discoveryBreadcrumbs,
  discoveryStructuredData,
} from '../lib/discovery-seo';
import {
  humanTag,
  verifiedDate,
  safeSourceUrl,
  jsonLd,
} from '../lib/destination-seo';
export function DiscoveryLinks({
  title,
  items,
}: {
  title: string;
  items: DiscoveryLink[];
}) {
  if (!items.length) return null;
  return (
    <section className="destination-related">
      <h2>{title}</h2>
      <ul className="destination-entity-grid">
        {items.map((e) => (
          <li key={e.id}>
            <Link href={entityPath(e)}>
              <h3>{e.name} ↗</h3>
            </Link>
            <p>Verified {verifiedDate(e.last_verified)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
export default function DiscoveryDetail({ detail: d }: { detail: Detail }) {
  const c = d.canonical,
    e = d.editorial,
    breadcrumbs = discoveryBreadcrumbs(d);
  const known = [
    c,
    ...d.destinations,
    ...d.places,
    ...d.experiences,
    ...d.nearby,
  ];
  return (
    <main id="destination-main" className="destination-detail">
      <nav className="destination-breadcrumb" aria-label="Breadcrumb">
        {breadcrumbs.map((b, i) => (
          <span key={b.path}>
            {i > 0 && <span aria-hidden="true"> / </span>}
            {i === breadcrumbs.length - 1 ? (
              <span aria-current="page">{b.name}</span>
            ) : (
              <Link href={b.path}>{b.name}</Link>
            )}
          </span>
        ))}
      </nav>
      <section className="destination-detail-title">
        <div>
          <span className="destination-eyebrow">
            {c.kind === 'PLACE' ? 'Attraction' : 'Experience concept'}
          </span>
          <h1>{c.name}</h1>
          {(e?.summary || c.summary) && <p>{e?.summary || c.summary}</p>}
        </div>
        <div className="destination-verification">
          <span aria-hidden="true">✓</span>
          <div>
            Knowledge last verified
            <strong>{verifiedDate(d.last_verified)}</strong>
            <a href="#discovery-sources">View sources ↗</a>
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
          />
        ) : (
          <LandscapePlaceholder />
        )}
        {e?.heroMedia && <figcaption>{e.heroMedia.credit}</figcaption>}
      </figure>
      <nav className="destination-section-links" aria-label="On this page">
        <a href="#discovery-overview">Overview</a>
        <a href="#discovery-facts">Quick facts</a>
        {d.experiences.length > 0 && (
          <a href="#discovery-experiences">Experiences</a>
        )}
        <a href="#discovery-sources">Sources</a>
      </nav>
      <div className="destination-detail-columns">
        <div>
          <article id="discovery-overview" className="destination-prose">
            <h2>{e?.title ?? `Discover ${c.name}`}</h2>
            {e ? (
              <>
                <p className="destination-byline">
                  By {e.author.displayName}
                  {e.reviewer && <> · Reviewed by {e.reviewer.displayName}</>}
                  {e.lastVerified && (
                    <> · Editorial verified {verifiedDate(e.lastVerified)}</>
                  )}
                </p>
                <Story editorial={e} known={known} />
              </>
            ) : (
              <p>
                {c.summary ??
                  'Explore the verified facts, connected entities and credited sources below. Editorial content will appear when it is published.'}
              </p>
            )}
          </article>
          <div id="discovery-experiences">
            <DiscoveryLinks
              title="Experiences connected to this place"
              items={d.experiences}
            />
          </div>
          <DiscoveryLinks title="Places for this experience" items={d.places} />
          <DiscoveryLinks
            title="Connected destinations"
            items={d.destinations}
          />
          {d.nearby.length > 0 && (
            <section className="destination-related">
              <h2>Nearby places</h2>
              <p>
                Connections from reviewed knowledge. Distances are straight-line
                estimates, not road distances or travel times.
              </p>
              <ul className="destination-entity-grid">
                {d.nearby.map((p) => (
                  <li key={p.id}>
                    <Link href={entityPath(p)}>
                      <h3>{p.name} ↗</h3>
                    </Link>
                    {p.distance_meters !== null && (
                      <p>
                        {Math.round(p.distance_meters).toLocaleString('en')} m
                        in a straight line
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside id="discovery-facts" className="destination-facts">
          <span className="destination-eyebrow">Quick facts</span>
          <h2>{c.name}</h2>
          <dl>
            <dt>{c.kind === 'PLACE' ? 'Place type' : 'Category'}</dt>
            <dd>
              {humanTag(
                (c.place_type ?? c.category ?? 'unclassified')
                  .toLowerCase()
                  .replaceAll('_', '-'),
              )}
            </dd>
            {d.geography && (
              <>
                <dt>Geographic owner</dt>
                <dd>{d.geography.name}</dd>
              </>
            )}
            <dt>Recommended duration</dt>
            <dd>
              {c.duration_minutes !== null
                ? `${c.duration_minutes} minutes`
                : 'Not yet verified'}
            </dd>
            <dt>Family suitability</dt>
            <dd>
              {c.family_suitable === null
                ? 'Not yet verified'
                : c.family_suitable
                  ? 'Marked suitable; review current advice'
                  : 'Not marked suitable'}
            </dd>
            {c.kind === 'PLACE' && (
              <>
                <dt>Opening information</dt>
                <dd>{c.opening_information ?? 'Not yet verified'}</dd>
                <dt>Admission information</dt>
                <dd>{c.admission_information ?? 'Not yet verified'}</dd>
                <dt>Best time</dt>
                <dd>{c.best_time ?? 'Not yet verified'}</dd>
                <dt>Accessibility</dt>
                <dd>{c.accessibility ?? 'Not yet verified'}</dd>
                <dt>Facilities</dt>
                <dd>
                  {c.facilities.length
                    ? c.facilities.join(' · ')
                    : 'No verified listing'}
                </dd>
              </>
            )}
            {c.seasons.length > 0 && (
              <>
                <dt>Season tags</dt>
                <dd>{c.seasons.map(humanTag).join(' · ')}</dd>
              </>
            )}
            {c.difficulty && (
              <>
                <dt>Difficulty</dt>
                <dd>{c.difficulty}</dd>
              </>
            )}
            {c.coordinates && (
              <>
                <dt>Geographic reference</dt>
                <dd>
                  {c.coordinates.latitude.toFixed(4)}°,{' '}
                  {c.coordinates.longitude.toFixed(4)}°
                </dd>
              </>
            )}
            <dt>Last verified</dt>
            <dd>{verifiedDate(c.last_verified)}</dd>
          </dl>
          <p>
            Check the credited sources and current conditions before visiting.
            {c.kind === 'EXPERIENCE' &&
              ' This is an independent experience concept.'}
          </p>
          <Link
            href={`/things-to-do/?${new URLSearchParams({ ...(d.destinations[0] ? { destination: d.destinations[0].slug } : {}), locale: c.locale })}`}
          >
            Explore more things to do →
          </Link>
        </aside>
      </div>
      <section id="discovery-sources" className="destination-sources">
        <div>
          <span className="destination-eyebrow">Knowledge you can trace</span>
          <h2>Sources & freshness</h2>
          <p>
            Knowledge verified {verifiedDate(d.last_verified)}.
            {e && <> Editorial updated {verifiedDate(e.lastUpdated)}.</>}
          </p>
        </div>
        <ul>
          {d.sources.map((s) => (
            <li key={s.id}>
              {safeSourceUrl(s.url) ? (
                <a
                  href={safeSourceUrl(s.url)!}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.title} ↗
                </a>
              ) : (
                <strong>{s.title}</strong>
              )}
              <span>
                {s.publisher} · Accessed {verifiedDate(s.accessed_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(discoveryStructuredData(d)) }}
      />
    </main>
  );
}
function Story({
  editorial: e,
  known,
}: {
  editorial: DestinationEditorial;
  known: DiscoveryLink[];
}) {
  return e.blocks.map((b, i) => {
    if (b.type === 'heading')
      return b.level === 2 ? (
        <h2 key={i}>{b.text}</h2>
      ) : (
        <h3 key={i}>{b.text}</h3>
      );
    if (b.type === 'paragraph') return <p key={i}>{b.text}</p>;
    if (b.type === 'list')
      return (
        <ul key={i}>
          {b.items.map((item, n) => (
            <li key={n}>{item}</li>
          ))}
        </ul>
      );
    if (b.type === 'callout')
      return (
        <aside key={i} className="destination-story-note">
          {b.text}
        </aside>
      );
    if (b.type === 'quote')
      return (
        <blockquote key={i}>
          {b.text}
          <cite>{b.attribution}</cite>
        </blockquote>
      );
    if (b.type === 'entity_reference') {
      const ref = known.find((k) => k.id === b.entityId);
      return (
        <aside key={i} className="destination-story-reference">
          {ref ? (
            <Link href={entityPath(ref)}>
              {b.label} · {ref.name} ↗
            </Link>
          ) : (
            <strong>{b.label}</strong>
          )}
        </aside>
      );
    }
    const m = e.media.find((m) => m.id === b.mediaId);
    return m ? (
      <figure key={i}>
        <Image
          src={`/editorial-media/${m.id}/`}
          alt={m.alt}
          width={m.width}
          height={m.height}
          unoptimized
        />
        <figcaption>
          {b.caption} · {m.credit}
        </figcaption>
      </figure>
    ) : null;
  });
}
