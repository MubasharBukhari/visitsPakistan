import Link from 'next/link';
import type { Metadata } from 'next';
import {
  searchQuerySchema,
  searchTypes,
  type SearchResponse,
} from '@visitspakistan/domain';
import { getSearch } from '../../../lib/search-api';
import { absoluteUrl, verifiedDate } from '../../../lib/destination-seo';
import '../../../components/search.css';
export const metadata: Metadata = {
  title: 'Search Pakistan | VisitsPakistan',
  description:
    'Search published destinations, attractions and experience concepts.',
  robots: { index: false, follow: true },
  alternates: { canonical: absoluteUrl('/search/') },
};
const labels = {
  DESTINATION: 'Destinations',
  PLACE: 'Attractions',
  EXPERIENCE: 'Experiences',
};
const popular = [
  'Hunza',
  'Skardu',
  'Lahore',
  'Islamabad',
  'trekking',
  'family activities',
];
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = searchQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(raw).filter(
        ([k, v]) =>
          ['q', 'type', 'destination', 'page', 'locale'].includes(k) &&
          v !== '',
      ),
    ),
  );
  let r: SearchResponse | null = null,
    error = '';
  if (parsed.success) {
    try {
      r = await getSearch(parsed.data);
    } catch {
      error = 'Search is temporarily unavailable. Please try again shortly.';
    }
  } else if (raw.q)
    error =
      'Check your query and filters. Use up to 120 characters and a valid page.';
  const query = typeof raw.q === 'string' ? raw.q : '';
  return (
    <main id="destination-main" className="destination-directory">
      <nav className="destination-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span aria-current="page">Search</span>
      </nav>
      <section className="destination-directory-hero">
        <div>
          <span className="destination-eyebrow">Connected discoveries</span>
          <h1>Find your next chapter.</h1>
          <p>
            Search destinations, attractions and experiences through sourced
            travel knowledge.
          </p>
        </div>
      </section>
      <form
        action="/search/"
        method="get"
        className="search-results-controls"
        role="search"
        aria-label="Search filters"
      >
        <label>
          Search Pakistan
          <input
            name="q"
            defaultValue={query}
            maxLength={120}
            required
            placeholder="Hunza, trekking, heritage…"
          />
        </label>
        <label>
          Entity type
          <select
            name="type"
            defaultValue={typeof raw.type === 'string' ? raw.type : ''}
          >
            <option value="">All discovery types</option>
            {searchTypes.map((t) => (
              <option key={t} value={t}>
                {labels[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Destination slug
          <input
            name="destination"
            defaultValue={
              typeof raw.destination === 'string' ? raw.destination : ''
            }
            placeholder="All destinations"
          />
        </label>
        <input
          type="hidden"
          name="locale"
          value={parsed.success ? parsed.data.locale : 'en'}
        />
        <button type="submit">Search →</button>
      </form>
      {error ? (
        <section className="destination-empty" role="alert">
          <h2>{error}</h2>
          <Link href="/destinations/">Browse destinations →</Link>
        </section>
      ) : r ? (
        <>
          <p role="status">
            {r.total} results for “{r.query}”
          </p>
          {r.total === 0 ? (
            <section className="destination-empty">
              <h2>No published discoveries match your search.</h2>
              <p>
                Try a shorter name, another spelling or fewer filters. Only
                approved travel knowledge appears here.
              </p>
            </section>
          ) : (
            r.groups
              .filter((g) => g.results.length > 0)
              .map((g) => (
                <section key={g.type} className="search-result-group">
                  <h2>
                    {labels[g.type]} <small>({g.total})</small>
                  </h2>
                  <ul>
                    {g.results.map((d) => (
                      <li key={d.id}>
                        <h3>
                          <Link href={d.url}>{d.name} ↗</Link>
                        </h3>
                        {d.summary && <p>{d.summary}</p>}
                        <small>Verified {verifiedDate(d.last_verified)}</small>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
          )}
          {r.total > 0 && r.groups.every((g) => !g.results.length) && (
            <p>No results on this page. Return to page 1.</p>
          )}
          {r.totalPages > 1 && (
            <nav
              className="destination-pagination"
              aria-label="Search pagination"
            >
              {[
                ...(r.page > 1 ? [r.page - 1] : []),
                ...(r.page < r.totalPages ? [r.page + 1] : []),
              ].map((page) => (
                <Link
                  key={page}
                  href={`/search/?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string')) as Record<string, string>), page: String(page) })}`}
                >
                  {page < r.page ? '← Previous' : 'Next →'}
                </Link>
              ))}
            </nav>
          )}
        </>
      ) : (
        <p>
          Start with a destination, landmark, activity or an alternative name.
        </p>
      )}
      <div className="search-popular" aria-label="Search ideas">
        {popular.map((q) => (
          <Link key={q} href={`/search/?q=${encodeURIComponent(q)}`}>
            {q}
          </Link>
        ))}
      </div>
    </main>
  );
}
