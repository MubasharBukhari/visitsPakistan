import {
  indexFamilies,
  indexDefinition,
  activeSearchTypes,
  searchBody,
} from './schema';
import type {
  SearchDocument,
  SearchQuery,
  SearchType,
} from '@visitspakistan/domain';
export class SearchUnavailable extends Error {
  constructor() {
    super('Search temporarily unavailable');
  }
}
export class OpenSearchClient {
  constructor(
    private readonly endpoint: string,
    readonly prefix = '',
    private readonly timeoutMs = 5000,
  ) {
    if (!/^[a-z0-9_]*$/.test(prefix))
      throw new Error('Invalid search namespace');
  }
  alias(type: SearchType) {
    return this.prefix + indexFamilies[type];
  }
  async request<T = unknown>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    try {
      const u = new URL(path, this.endpoint);
      const auth = u.username
        ? `Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64')}`
        : undefined;
      u.username = '';
      u.password = '';
      const r = await fetch(u, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: auth } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!r.ok) throw new SearchUnavailable();
      return (await r.json()) as T;
    } catch {
      throw new SearchUnavailable();
    }
  }
  async aliases(): Promise<Partial<Record<SearchType, string>> | null> {
    const r =
      await this.request<Record<string, { aliases: Record<string, unknown> }>>(
        '/_alias',
      );
    const pairs = activeSearchTypes.map(
      (t) =>
        [
          t,
          Object.keys(r).find((k) =>
            Object.hasOwn(r[k]!.aliases, this.alias(t)),
          ),
        ] as const,
    );
    if (pairs.every(([, v]) => !v)) return null;
    return Object.fromEntries(pairs) as Partial<Record<SearchType, string>>;
  }
  async createGeneration(token: string) {
    const indexes = {} as Record<SearchType, string>;
    for (const type of activeSearchTypes) {
      const name = `${this.alias(type)}_${token}`;
      await this.request(`/${name}`, 'PUT', indexDefinition());
      indexes[type] = name;
    }
    return indexes;
  }
  async switchAliases(indexes: Record<SearchType, string>) {
    const previous = await this.aliases();
    const actions: unknown[] = [];
    for (const t of activeSearchTypes) {
      if (previous?.[t])
        actions.push({ remove: { index: previous[t], alias: this.alias(t) } });
      actions.push({
        add: { index: indexes[t], alias: this.alias(t), is_write_index: true },
      });
    }
    await this.request('/_aliases', 'POST', { actions });
  }
  async bulk(
    upserts: SearchDocument[],
    removed: Array<{ id: string; type: SearchType }>,
    indexes?: Record<SearchType, string>,
  ) {
    if (!upserts.length && !removed.length) return;
    const lines: string[] = [];
    for (const d of upserts) {
      lines.push(
        JSON.stringify({
          index: { _index: indexes?.[d.type] ?? this.alias(d.type), _id: d.id },
        }),
        JSON.stringify({
          ...d,
          search_text: [
            d.name,
            ...d.alternative_names,
            d.summary ?? '',
            d.category ?? '',
            ...d.tags,
            ...d.context_names,
          ].join(' '),
        }),
      );
    }
    for (const d of removed)
      lines.push(
        JSON.stringify({
          delete: {
            _index: indexes?.[d.type] ?? this.alias(d.type),
            _id: d.id,
          },
        }),
      );
    try {
      const u = new URL('/_bulk?refresh=wait_for', this.endpoint);
      const auth = u.username
        ? `Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64')}`
        : undefined;
      u.username = '';
      u.password = '';
      const r = await fetch(u, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          ...(auth ? { Authorization: auth } : {}),
        },
        body: lines.join('\n') + '\n',
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw new SearchUnavailable();
      const result = (await r.json()) as {
        errors: boolean;
        items: Array<Record<string, { status: number }>>;
      };
      if (
        result.errors ||
        result.items.some((i) =>
          Object.values(i).some((v) => v.status >= 300 && v.status !== 404),
        )
      )
        throw new SearchUnavailable();
    } catch {
      throw new SearchUnavailable();
    }
  }
  async query(type: SearchType, q: SearchQuery, ids: string[]) {
    const r = await this.request<{
      hits: {
        total: { value: number };
        hits: Array<{ _id: string; _source: { id: string } }>;
      };
    }>(`/${this.alias(type)}/_search`, 'POST', searchBody(q, ids));
    return {
      total: r.hits.total.value,
      ids: r.hits.hits.map((h) => h._source.id),
    };
  }
}
