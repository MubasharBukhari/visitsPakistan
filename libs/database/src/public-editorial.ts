import {
  destinationPresentationSchema,
  EditorialError,
  type DestinationEditorial,
  type EditorialType,
} from '@visitspakistan/domain';
import type { Prisma } from './generated/client';
import { EditorialStore } from './editorial-store';
/** Content-owned immutable public projection; never returns a draft or staff credentials. */
export async function publishedEditorial(
  store: EditorialStore,
  tx: Prisma.TransactionClient,
  entityId: string,
  type: EditorialType,
  locale: string,
): Promise<DestinationEditorial | null> {
  const candidates = await tx.contentItem.findMany({
    where: {
      primaryEntityId: entityId,
      type,
      entity: { locale, status: 'PUBLISHED', deletedAt: null },
      editorial: { publishedRevisionId: { not: null } },
    },
    select: { entity: { select: { slug: true } } },
    orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
    take: 20,
  });
  for (const c of candidates) {
    try {
      const r = await store.getPublished(c.entity.slug, locale, tx);
      return {
        id: r.id,
        type: r.type,
        slug: r.slug,
        locale: r.locale,
        title: r.title,
        summary: r.summary,
        seoTitle: r.seoTitle,
        metaDescription: r.metaDescription,
        blocks: r.blocks as unknown as DestinationEditorial['blocks'],
        destination: r.destination
          ? destinationPresentationSchema.parse(r.destination)
          : null,
        author: r.author,
        reviewer: r.reviewer,
        firstPublished: r.firstPublished?.toISOString() ?? null,
        lastUpdated: r.lastUpdated.toISOString(),
        lastVerified: r.lastVerified?.toISOString() ?? null,
        heroMedia: r.heroMedia ?? null,
        media: r.media,
        sources: r.sources.map((s) => ({
          id: s.id,
          title: s.title,
          publisher: s.publisher,
          url: s.url,
          accessed_at: s.accessedAt.toISOString(),
        })),
        canonicalEntities: r.canonicalEntities,
      };
    } catch (e) {
      if (!(e instanceof EditorialError && e.status === 404)) throw e;
    }
  }
  return null;
}
