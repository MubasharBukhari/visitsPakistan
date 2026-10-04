import type { SearchDocument } from '@visitspakistan/domain';
import { Prisma, type PrismaClient } from './generated/client';
import { discoveryPublicCte } from './discovery-reader';
// Share discovery eligibility rather than silently loosening publication gates.
export class SearchProjectionReader {
  constructor(private readonly db: PrismaClient) {}
  async snapshot(): Promise<SearchDocument[]> {
    const rows = await this.db.$queryRaw<
      SearchDocument[]
    >(Prisma.sql`${discoveryPublicCte},
 ancestors AS (
  WITH RECURSIVE walk AS (
   SELECT d.id AS destination_id,g.id,g.parent_id,e.name,e.locale,g.alt_names FROM destinations d JOIN geography g ON g.id=d.id JOIN public_entities e ON e.id=g.id
   UNION ALL SELECT w.destination_id,g.id,g.parent_id,e.name,e.locale,g.alt_names FROM walk w JOIN geography g ON g.id=w.parent_id JOIN public_entities e ON e.id=g.id
  ) SELECT * FROM walk
 ), all_nodes AS (
 SELECT d.id,'DESTINATION'::text AS type,d.locale,d.name,d.slug,LEAST(d.last_verified,p.last_verified) AS last_verified,g.alt_names,g.summary,NULL::text AS category,p.interests || p.seasons AS tags,NULL::boolean AS family_suitable,g.location
 FROM destinations d JOIN geography g ON g.id=d.id JOIN destination_profile p ON p.id=d.id
 UNION ALL SELECT n.id,n.kind::text,n.locale,n.name,n.slug,e.last_verified,COALESCE(p.alt_names,x.alt_names),COALESCE(p.summary,x.summary),n.category,n.seasons,n.family_suitable,p.location
 FROM nodes n JOIN public_entities e ON e.id=n.id LEFT JOIN place p ON p.id=n.id LEFT JOIN experience x ON x.id=n.id
 ), links AS (
 SELECT destination_id,node_id FROM associations
 UNION SELECT id,id FROM destinations
 ) SELECT a.id,a.type,a.locale,a.name,a.slug,a.alt_names AS alternative_names,a.summary,a.category,
 a.tags,a.family_suitable,
 COALESCE((SELECT array_agg(DISTINCT d.slug ORDER BY d.slug) FROM links l JOIN destinations d ON d.id=l.destination_id WHERE l.node_id=a.id AND d.locale=a.locale),'{}'::text[]) AS destination_slugs,
 COALESCE((SELECT array_agg(DISTINCT word ORDER BY word) FROM links l JOIN ancestors p ON p.destination_id=l.destination_id CROSS JOIN LATERAL unnest(ARRAY[p.name] || p.alt_names) word WHERE l.node_id=a.id AND p.locale=a.locale),'{}'::text[]) AS context_names,
 CASE WHEN a.location IS NULL THEN NULL ELSE json_build_object('lat',ST_Y(a.location::geometry),'lon',ST_X(a.location::geometry)) END AS location,
 a.last_verified::text AS last_verified FROM all_nodes a ORDER BY a.id LIMIT 20001`);
    if (rows.length > 20000)
      throw new Error(
        'Search projection capacity exceeded; implement bulk eligibility strategy',
      );
    return rows.map((r) => ({
      ...r,
      tags: [
        ...r.tags,
        ...(r.family_suitable === true ? ['family suitable'] : []),
      ],
      last_verified: new Date(r.last_verified).toISOString(),
    }));
  }
}
