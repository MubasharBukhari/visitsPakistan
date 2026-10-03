import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { thingsQuerySchema, destinationSeasons } from '@visitspakistan/domain';
import { getThings } from '../../../lib/discovery-api';
import { entityPath } from '../../../lib/discovery-seo';
import { absoluteUrl, humanTag, jsonLd } from '../../../lib/destination-seo';
import { LandscapePlaceholder } from '../../../components/destination-card';
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const raw = await searchParams,
    locale =
      typeof raw.locale === 'string' &&
      /^[a-z]{2}(-[A-Z]{2})?$/.test(raw.locale)
        ? raw.locale
        : 'en';
  const canonical = absoluteUrl(
    `/things-to-do/${locale === 'en' ? '' : `?locale=${locale}`}`,
  );
  return {
    title: 'Things to do in Pakistan | VisitsPakistan',
    description:
      'Explore sourced attractions and independent experience concepts connected to Pakistan destinations.',
    alternates: { canonical },
    robots: {
      index:
        Object.keys(raw).every((k) => k === 'locale') &&
        (raw.locale === undefined || raw.locale === locale),
      follow: true,
    },
    openGraph: {
      title: 'Things to do in Pakistan | VisitsPakistan',
      description: 'Attractions, places and experience concepts to explore.',
      url: canonical,
      type: 'website',
    },
  };
}
export default async function Things({ searchParams }: Props) {
  const raw = await searchParams;
  const parsed = thingsQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(raw).filter(
        ([k, v]) =>
          [
            'destination',
            'category',
            'season',
            'familySuitable',
            'duration',
            'kind',
            'page',
            'pageSize',
            'locale',
          ].includes(k) && v !== '',
      ),
    ),
  );
  if (!parsed.success)
    return (
      <main id="destination-main" className="destination-empty">
        <h1>Check your discovery filters</h1>
        <p>
          Use a valid destination, season, suitability and positive duration in
          minutes.
        </p>
        <Link href="/things-to-do/">Reset filters</Link>
      </main>
    );
  const q = parsed.data,
    r = await getThings(q);
  const href = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q))
      if (v !== undefined) p.set(k, String(v));
    p.set('page', String(page));
    return `/things-to-do/?${p}`;
  };
  return (
    <main id="destination-main" className="destination-directory">
      <nav className="destination-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Things to do</span>
      </nav>
      <section className="destination-directory-hero">
        <div>
          <span className="destination-eyebrow">Follow your curiosity</span>
          <h1>
            More ways to
            <br />
            experience Pakistan.
          </h1>
          <p>
            Explore connected attractions and experiences.
            <br />
            Start with places, facts and credited sources.
          </p>
        </div>
      </section>
      <form
        method="get"
        action="/things-to-do/"
        className="destination-filters discovery-filters"
        aria-label="Filter things to do"
      >
        <input type="hidden" name="locale" value={q.locale} />
        <label>
          Destination
          <select name="destination" defaultValue={q.destination ?? ''}>
            <option value="">All destinations</option>
            {r.facets.destinations.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select name="category" defaultValue={q.category ?? ''}>
            <option value="">All categories</option>
            {r.facets.categories.map((c) => (
              <option key={c} value={c}>
                {humanTag(c)}
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
        <label>
          Family suitability
          <select
            name="familySuitable"
            defaultValue={
              q.familySuitable === undefined ? '' : String(q.familySuitable)
            }
          >
            <option value="">Any / unknown</option>
            <option value="true">Marked suitable</option>
            <option value="false">Not marked suitable</option>
          </select>
        </label>
        <label>
          Maximum minutes
          <input
            type="number"
            name="duration"
            min={1}
            max={10080}
            step={1}
            defaultValue={q.duration ?? ''}
            placeholder="Any duration"
          />
        </label>
        <label>
          Explore
          <select name="kind" defaultValue={q.kind ?? ''}>
            <option value="">Attractions & experiences</option>
            <option value="place">Attractions</option>
            <option value="experience">Experience concepts</option>
          </select>
        </label>
        <button type="submit">Find things to do →</button>
      </form>
      <div className="destination-results-bar">
        <h2>Discoveries for the journey</h2>
        <span>
          {r.pagination.total} results ·{' '}
          <Link
            href={`/things-to-do/${q.locale === 'en' ? '' : `?locale=${q.locale}`}`}
          >
            Clear filters
          </Link>
        </span>
      </div>
      {r.data.length ? (
        <div className="destination-grid">
          {r.data.map((d) => (
            <article className="destination-card" key={d.canonical.id}>
              <Link
                href={entityPath(d.canonical)}
                aria-label={`Explore ${d.canonical.name}`}
                className="destination-card-cover"
              >
                {d.editorial?.heroMedia ? (
                  <Image
                    src={`/editorial-media/${d.editorial.heroMedia.id}/`}
                    alt={d.editorial.heroMedia.alt}
                    width={d.editorial.heroMedia.width}
                    height={d.editorial.heroMedia.height}
                    unoptimized
                  />
                ) : (
                  <LandscapePlaceholder />
                )}
              </Link>
              <div className="destination-card-copy">
                <span className="destination-eyebrow">
                  {d.canonical.kind === 'PLACE'
                    ? 'Attraction'
                    : 'Experience concept'}
                </span>
                <h2>
                  <Link href={entityPath(d.canonical)}>{d.canonical.name}</Link>
                </h2>
                {(d.editorial?.summary || d.canonical.summary) && (
                  <p>{d.editorial?.summary || d.canonical.summary}</p>
                )}
                <Link
                  href={entityPath(d.canonical)}
                  className="destination-text-link"
                >
                  Explore →
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="destination-empty">
          <h2>No published discoveries match these filters.</h2>
          <p>
            Try another destination or fewer filters. Unknown duration and
            family suitability do not match those filters.
          </p>
          <Link href="/things-to-do/">Explore all things to do →</Link>
        </section>
      )}
      {r.pagination.totalPages > 1 && q.page <= r.pagination.totalPages && (
        <nav className="destination-pagination" aria-label="Pagination">
          {q.page > 1 && (
            <Link rel="prev" href={href(q.page - 1)}>
              ← Previous
            </Link>
          )}
          <span>
            Page {q.page} of {r.pagination.totalPages}
          </span>
          {q.page < r.pagination.totalPages && (
            <Link rel="next" href={href(q.page + 1)}>
              Next →
            </Link>
          )}
        </nav>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Things to do in Pakistan',
            url: absoluteUrl(
              `/things-to-do/${q.locale === 'en' ? '' : `?locale=${q.locale}`}`,
            ),
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: r.data.map((d, i) => ({
                '@type': 'ListItem',
                position: (q.page - 1) * q.pageSize + i + 1,
                name: d.canonical.name,
                url: absoluteUrl(entityPath(d.canonical)),
              })),
            },
          }),
        }}
      />
    </main>
  );
}
