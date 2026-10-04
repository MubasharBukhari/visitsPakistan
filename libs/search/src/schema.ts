import type {
  SearchDocument,
  SearchQuery,
  SearchType,
} from '@visitspakistan/domain';
export const indexFamilies = {
  DESTINATION: 'destinations_v1',
  PLACE: 'places_v1',
  EXPERIENCE: 'experiences_v1',
  CONTENT: 'content_v1',
  PARTNER: 'partners_v1',
  PRODUCT: 'products_v1',
  EVENT: 'events_v1',
} as const;
// Intent synonyms are search policy, not canonical travel facts.
export const synonyms = [
  'northern areas, northern pakistan',
  'hiking, trekking',
  'boat, boating',
  'family activities, family suitable',
  'food, cuisine, culinary',
  'heritage, historical, historic',
  'photography, photos',
  'camping, campsite',
];
export const familyIntent = (q: string) =>
  /family (activities|suitable)/i.test(q);
export function indexDefinition() {
  const text = {
    type: 'text',
    analyzer: 'travel',
    search_analyzer: 'travel_query',
  };
  return {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        char_filter: {
          urdu_normalization: {
            type: 'mapping',
            mappings: ['ي => ی', 'ك => ک', 'ى => ی', 'ـ =>'],
          },
        },
        filter: { travel_synonyms: { type: 'synonym_graph', synonyms } },
        analyzer: {
          travel: {
            type: 'custom',
            char_filter: ['urdu_normalization'],
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding'],
          },
          travel_query: {
            type: 'custom',
            char_filter: ['urdu_normalization'],
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding', 'travel_synonyms'],
          },
        },
      },
    },
    mappings: {
      dynamic: 'strict',
      properties: {
        id: { type: 'keyword' },
        type: { type: 'keyword' },
        locale: { type: 'keyword' },
        name: {
          ...text,
          fields: {
            exact: { type: 'keyword' },
            suggest: { type: 'search_as_you_type', analyzer: 'travel' },
          },
        },
        alternative_names: {
          ...text,
          fields: {
            suggest: { type: 'search_as_you_type', analyzer: 'travel' },
          },
        },
        summary: text,
        search_text: text,
        category: text,
        tags: text,
        context_names: text,
        destination_slugs: { type: 'keyword' },
        family_suitable: { type: 'boolean' },
        location: { type: 'geo_point' },
        slug: { type: 'keyword' },
        last_verified: { type: 'date' },
      },
    },
  };
}
export function searchBody(q: SearchQuery, ids: string[]) {
  const should: unknown[] = [
    { term: { 'name.exact': { value: q.q, boost: 25 } } },
    {
      multi_match: {
        query: q.q,
        type: 'phrase',
        fields: ['name^10', 'alternative_names^8'],
        boost: 3,
      },
    },
    {
      multi_match: {
        query: q.q,
        fields: [
          'name^8',
          'alternative_names^6',
          'category^3',
          'tags^3',
          'context_names^2',
          'summary',
          'search_text',
        ],
        operator: 'and',
        fuzziness: 'AUTO',
        prefix_length: 0,
        max_expansions: 25,
      },
    },
    {
      multi_match: {
        query: q.q,
        type: 'bool_prefix',
        fields: [
          'name.suggest^4',
          'name.suggest._2gram',
          'name.suggest._3gram',
          'alternative_names.suggest^3',
          'alternative_names.suggest._2gram',
        ],
        operator: 'and',
      },
    },
  ];
  const query = {
    bool: {
      filter: [{ terms: { id: ids } }, { term: { locale: q.locale } }],
      should,
      minimum_should_match: 1,
    },
  };
  return {
    size: q.autocomplete ? 5 : 12,
    from: q.autocomplete ? 0 : (q.page - 1) * 12,
    track_total_hits: true,
    _source: ['id'],
    sort: [{ _score: 'desc' }, { id: 'asc' }],
    query:
      q.lat !== undefined
        ? {
            function_score: {
              query,
              functions: [
                {
                  filter: { exists: { field: 'location' } },
                  gauss: {
                    location: {
                      origin: { lat: q.lat, lon: q.lon },
                      scale: '50km',
                      decay: 0.5,
                    },
                  },
                  weight: 0.2,
                },
                {
                  filter: {
                    bool: { must_not: [{ exists: { field: 'location' } }] },
                  },
                  weight: 0,
                },
              ],
              score_mode: 'sum',
              boost_mode: 'sum',
              max_boost: 0.2,
            },
          }
        : query,
  };
}
export function canonicalSearchUrl(
  d: Pick<SearchDocument, 'type' | 'slug' | 'locale'>,
) {
  const family =
    d.type === 'DESTINATION'
      ? 'destinations'
      : d.type === 'PLACE'
        ? 'places'
        : 'experiences';
  return `/${family}/${encodeURIComponent(d.slug)}/${d.locale === 'en' ? '' : `?locale=${encodeURIComponent(d.locale)}`}`;
}
export const activeSearchTypes: readonly SearchType[] = [
  'DESTINATION',
  'PLACE',
  'EXPERIENCE',
];
