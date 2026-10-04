import {
  searchQuerySchema,
  type SearchResponse,
  type SearchDocument,
  type SearchResult,
} from '@visitspakistan/domain';
import { canonicalSearchUrl, activeSearchTypes, familyIntent } from './schema';
import { OpenSearchClient } from './client';
export interface SearchProjectionPort {
  snapshot(): Promise<SearchDocument[]>;
}
export class UnifiedSearch {
  constructor(
    private readonly canonical: SearchProjectionPort,
    private readonly search: OpenSearchClient,
  ) {}
  async query(input: unknown): Promise<SearchResponse> {
    const q = searchQuerySchema.parse(input);
    const rows = (await this.canonical.snapshot()).filter(
      (d) =>
        d.locale === q.locale &&
        (!q.type || d.type === q.type) &&
        (!familyIntent(q.q) || d.family_suitable === true) &&
        (!q.destination || d.destination_slugs.includes(q.destination)),
    );
    const byId = new Map(rows.map((d) => [d.id, d]));
    const groups = await Promise.all(
      activeSearchTypes
        .filter((t) => !q.type || q.type === t)
        .map(async (type) => {
          const ids = rows.filter((d) => d.type === type).map((d) => d.id);
          if (!ids.length)
            return { type, total: 0, results: [] as SearchResult[] };
          const hits = await this.search.query(type, q, ids);
          return {
            type,
            total: hits.total,
            results: hits.ids.flatMap((id) => {
              const d = byId.get(id);
              return d ? [{ ...d, url: canonicalSearchUrl(d) }] : [];
            }),
          };
        }),
    );
    // Empty canonical dataset has a legitimate empty result even before initial indexing.
    const total = groups.reduce((n, g) => n + g.total, 0);
    return {
      query: q.q,
      page: q.page,
      pageSize: q.autocomplete ? 5 : 12,
      total,
      totalPages: Math.max(
        0,
        ...groups.map((g) => Math.ceil(g.total / (q.autocomplete ? 5 : 12))),
      ),
      groups,
      suggestions: groups
        .flatMap((g) =>
          g.results
            .slice(0, 2)
            .map((d) => ({ name: d.name, url: d.url, type: d.type })),
        )
        .slice(0, 6),
    };
  }
}
