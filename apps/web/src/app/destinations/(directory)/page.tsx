import Link from 'next/link';
import type { Metadata } from 'next';
import {
  destinationQuerySchema,
  destinationSeasons,
} from '@visitspakistan/domain';
import { getDestinations } from '../../../lib/destination-api';
import {
  absoluteUrl,
  directoryPath,
  destinationPath,
  humanTag,
  jsonLd,
} from '../../../lib/destination-seo';
import { DestinationCard } from '../../../components/destination-card';
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const raw = await searchParams;
  const canonical = absoluteUrl(
    directoryPath(
      typeof raw.locale === 'string' &&
        /^[a-z]{2}(-[A-Z]{2})?$/.test(raw.locale)
        ? raw.locale
        : 'en',
    ),
  );
  return {
    title: 'Explore destinations in Pakistan | VisitsPakistan',
    description:
      'Discover destinations in Pakistan through verified places, editorial guides and geographic connections.',
    alternates: { canonical },
    robots: {
      index:
        Object.keys(raw).every((k) => k === 'locale') &&
        (raw.locale === undefined ||
          (typeof raw.locale === 'string' &&
            /^[a-z]{2}(-[A-Z]{2})?$/.test(raw.locale))),
      follow: true,
    },
    openGraph: {
      title: 'Explore Pakistan, one destination at a time',
      description: 'Places to discover. Stories to follow.',
      url: canonical,
      type: 'website',
    },
  };
}
export default async function Directory({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = destinationQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(raw)
        .filter(([key]) =>
          [
            'region',
            'interest',
            'season',
            'page',
            'pageSize',
            'locale',
          ].includes(key),
        )
        .filter(([, value]) => value !== ''),
    ),
  );
  if (!parsed.success)
    return (
      <main id="destination-main" className="destination-empty">
        <h1>Check your destination filters</h1>
        <p>
          Choose a valid region, interest or season and a positive page number.
        </p>
        <Link href="/destinations/">Reset filters</Link>
      </main>
    );
  const q = parsed.data;
  const result = await getDestinations(q);
  const filtered = Boolean(q.region || q.interest || q.season);
  const pageHref = (page: number) => {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(q))
      if (value !== undefined) p.set(key, String(value));
    p.set('page', String(page));
    return `/destinations/?${p}`;
  };
  return (
    <main id="destination-main" className="destination-directory">
      <nav className="destination-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Destinations</span>
      </nav>
      <section className="destination-directory-hero">
        <div>
          <span className="destination-eyebrow">
            Your next chapter starts here
          </span>
          <h1>
            Find your corner
            <br />
            of Pakistan.
          </h1>
          <p>
            Follow a landscape, an interest, a season.
            <br />
            Discover places through stories and trusted knowledge.
          </p>
        </div>
        <div className="destination-hero-mark" aria-hidden="true">
          <span>Explore</span>
          <b>Pakistan</b>
          <i>Discover · Experience</i>
        </div>
      </section>
      <form
        method="get"
        action="/destinations/"
        className="destination-filters"
        aria-label="Filter destinations"
      >
        <input type="hidden" name="locale" value={q.locale} />
        <label>
          Region
          <select name="region" defaultValue={q.region ?? ''}>
            <option value="">All regions</option>
            {result.facets.regions.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Interest
          <select name="interest" defaultValue={q.interest ?? ''}>
            <option value="">All interests</option>
            {result.facets.interests.map((i) => (
              <option key={i} value={i}>
                {humanTag(i)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Season
          <select name="season" defaultValue={q.season ?? ''}>
            <option value="">Any season</option>
            {destinationSeasons.map((s) => (
              <option key={s} value={s}>
                {humanTag(s)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">
          Find destinations <span aria-hidden="true">→</span>
        </button>
      </form>
      <div className="destination-results-bar">
        <h2>{filtered ? 'Your discoveries' : 'Places to begin'}</h2>
        <span>
          {result.pagination.total} destination
          {result.pagination.total === 1 ? '' : 's'}
          {filtered && (
            <>
              {' '}
              · <Link href={directoryPath(q.locale)}>Clear filters</Link>
            </>
          )}
        </span>
      </div>
      {result.data.length ? (
        <div className="destination-grid">
          {result.data.map((d) => (
            <DestinationCard key={d.canonical.id} destination={d} />
          ))}
        </div>
      ) : (
        <section className="destination-empty">
          <span aria-hidden="true">◇</span>
          <h2>
            {filtered
              ? 'A different path might lead you there.'
              : q.page > 1
                ? 'You’ve reached the end of these discoveries.'
                : 'Our destination collection is taking shape.'}
          </h2>
          <p>
            {filtered
              ? 'Try another region, interest or season.'
              : 'Verified destinations will appear here as they are reviewed and published.'}
          </p>
          {(filtered || q.page > 1) && (
            <Link href={directoryPath(q.locale)}>
              Explore all destinations →
            </Link>
          )}
        </section>
      )}
      {result.pagination.totalPages > 1 &&
        q.page <= result.pagination.totalPages && (
          <nav className="destination-pagination" aria-label="Pagination">
            {q.page > 1 && (
              <Link rel="prev" href={pageHref(q.page - 1)}>
                ← Previous
              </Link>
            )}
            <span>
              Page {q.page} of {result.pagination.totalPages}
            </span>
            {q.page < result.pagination.totalPages && (
              <Link rel="next" href={pageHref(q.page + 1)}>
                Next →
              </Link>
            )}
          </nav>
        )}
      <section className="destination-directory-note">
        <span>Grounded in trusted knowledge</span>
        <p>
          Canonical places, published stories and credited sources. A clearer
          starting point for your next journey.
        </p>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Pakistan destinations',
            url: absoluteUrl(directoryPath(q.locale)),
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: result.data.map((d, i) => ({
                '@type': 'ListItem',
                position: (q.page - 1) * q.pageSize + i + 1,
                name: d.canonical.name,
                url: absoluteUrl(
                  destinationPath(d.canonical.slug, d.canonical.locale),
                ),
              })),
            },
          }),
        }}
      />
    </main>
  );
}
