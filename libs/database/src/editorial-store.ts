import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  assertTransition,
  canEdit,
  createEditorialSchema,
  editorialBodySchema,
  EditorialError,
  editorialTypes,
  mediaIds,
  readyForReview,
  referenceIds,
  requireRole,
  themeTokensSchema,
  validateTheme,
  blockTypes,
  type CmsActor,
  type EditorialBody,
} from '@visitspakistan/domain';
import { Prisma, type PrismaClient } from './generated/client';
const staffProjection = { id: true, displayName: true } as const;
const revisionInclude = {
  author: { select: staffProjection },
  reviewer: { select: staffProjection },
  heroMedia: true,
  sources: { include: { source: true } },
  references: {
    include: {
      entity: {
        select: {
          id: true,
          kind: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true,
          primarySource: true,
        },
      },
    },
  },
} as const;
const docInclude = {
  contentItem: { include: { entity: true } },
  currentRevision: { include: revisionInclude },
  publishedRevision: { include: revisionInclude },
} as const;
export class EditorialStore {
  constructor(readonly db: PrismaClient) {}
  async close() {
    await this.db.$disconnect();
  }
  async actor(actor: CmsActor) {
    const current = await this.db.staffAccount.findUnique({
      where: { id: actor.id },
    });
    if (!current?.active)
      throw new EditorialError(401, 'Staff sign-in required');
    return {
      id: current.id,
      roles: current.roles,
      displayName: current.displayName,
    };
  }
  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let retry = 0; ; retry++) {
      try {
        return await this.db.$transaction(work, {
          isolationLevel: 'Serializable',
          timeout: 15000,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2034' &&
          retry < 2
        )
          continue;
        throw e;
      }
    }
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actor: CmsActor,
    action: string,
    id: string,
    revisionId?: string,
  ) {
    await tx.cmsAudit.create({
      data: {
        actorId: actor.id,
        action,
        resourceId: id,
        metadata: revisionId ? { revisionId } : {},
      },
    });
    await tx.contentOutbox.create({
      data: { event: action, resourceId: id, revisionId },
    });
  }
  private async evidence(
    tx: Prisma.TransactionClient,
    revisionId: string,
    body: EditorialBody,
    primary: string | null,
  ) {
    const ids = referenceIds(body, primary);
    const entities = await tx.entityRegistry.findMany({
      where: { id: { in: ids }, deletedAt: null, status: { not: 'WITHDRAWN' } },
    });
    if (entities.length !== ids.length)
      throw new EditorialError(
        422,
        'Canonical references must be existing active entities',
      );
    const sources = await tx.sourceRecord.count({
      where: { id: { in: [...new Set(body.sourceIds)] }, retiredAt: null },
    });
    if (sources !== new Set(body.sourceIds).size)
      throw new EditorialError(422, 'Use existing active source records');
    const assets = mediaIds(body);
    if (
      (await tx.mediaAsset.count({
        where: { id: { in: assets }, deletedAt: null },
      })) !== assets.length
    )
      throw new EditorialError(422, 'Use existing active media');
    await tx.editorialSource.createMany({
      data: [...new Set(body.sourceIds)].map((sourceId) => ({
        revisionId,
        sourceId,
      })),
    });
    await tx.editorialEntityReference.createMany({
      data: ids.map((entityId) => ({ revisionId, entityId })),
    });
  }
  private bodyData(body: EditorialBody) {
    return {
      title: body.title,
      summary: body.summary,
      seoTitle: body.seoTitle,
      metaDescription: body.metaDescription,
      blocks: body.blocks as Prisma.InputJsonValue,
      heroMediaId: body.heroMediaId,
      lastVerified: body.lastVerified ? new Date(body.lastVerified) : null,
    };
  }
  async create(actor: CmsActor, input: unknown) {
    actor = await this.actor(actor);
    if (!actor.roles.includes('CONTRIBUTOR') && !actor.roles.includes('EDITOR'))
      throw new EditorialError(403, 'Editorial permission required');
    const data = createEditorialSchema.parse(input);
    const id = randomUUID();
    await this.transaction(async (tx) => {
      if (
        (data.type === 'DESTINATION_EDITORIAL' ||
          data.type === 'ATTRACTION_EDITORIAL') &&
        !data.primaryEntityId
      )
        throw new EditorialError(
          422,
          'Choose the canonical destination or attraction',
        );
      if (data.primaryEntityId) {
        const entity = await tx.entityRegistry.findUnique({
          where: { id: data.primaryEntityId },
          include: { geoEntity: true },
        });
        if (!entity || entity.deletedAt || entity.status === 'WITHDRAWN')
          throw new EditorialError(422, 'Choose an active canonical entity');
        if (
          data.type === 'DESTINATION_EDITORIAL' &&
          (entity.kind !== 'GEO_ENTITY' ||
            !['DESTINATION', 'CITY'].includes(entity.geoEntity?.type ?? ''))
        )
          throw new EditorialError(
            422,
            'Destination editorial must reference a canonical destination',
          );
        if (data.type === 'ATTRACTION_EDITORIAL' && entity.kind !== 'PLACE')
          throw new EditorialError(
            422,
            'Attraction editorial must reference a canonical place',
          );
      }
      await tx.entityRegistry.create({
        data: {
          id,
          kind: 'CONTENT_ITEM',
          name: data.body.title,
          slug: data.slug,
          locale: data.locale,
          primarySourceId: data.body.sourceIds[0],
          contentItem: {
            create: { type: data.type, primaryEntityId: data.primaryEntityId },
          },
        },
      });
      await tx.editorialDocument.create({ data: { id } });
      const revision = await tx.editorialRevision.create({
        data: {
          documentId: id,
          number: 1,
          authorId: actor.id,
          ...this.bodyData(data.body),
        },
      });
      await this.evidence(tx, revision.id, data.body, data.primaryEntityId);
      await tx.editorialDocument.update({
        where: { id },
        data: { currentRevisionId: revision.id },
      });
      await this.audit(tx, actor, 'editorial.created', id, revision.id);
    });
    return this.getAdmin(actor, id);
  }
  async getAdmin(actor: CmsActor, id: string) {
    actor = await this.actor(actor);
    const doc = await this.db.editorialDocument.findUnique({
      where: { id },
      include: docInclude,
    });
    if (!doc) throw new EditorialError(404, 'Content not found');
    if (
      !actor.roles.includes('EDITOR') &&
      !actor.roles.includes('ADMINISTRATOR') &&
      doc.currentRevision?.authorId !== actor.id
    )
      throw new EditorialError(403, 'Permission denied');
    return doc;
  }
  async list(actor: CmsActor) {
    actor = await this.actor(actor);
    return this.db.editorialDocument.findMany({
      where:
        actor.roles.includes('EDITOR') || actor.roles.includes('ADMINISTRATOR')
          ? {}
          : { currentRevision: { authorId: actor.id } },
      include: docInclude,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  async update(actor: CmsActor, id: string, input: unknown) {
    actor = await this.actor(actor);
    const data = z
      .object({ expectedVersion: z.number().int(), body: editorialBodySchema })
      .strict()
      .parse(input);
    await this.transaction(async (tx) => {
      const doc = await tx.editorialDocument.findUnique({
        where: { id },
        include: { currentRevision: true, contentItem: true },
      });
      if (!doc?.currentRevision)
        throw new EditorialError(404, 'Content not found');
      const r = doc.currentRevision;
      if (!canEdit(actor, r.authorId))
        throw new EditorialError(403, 'Permission denied');
      if (doc.version !== data.expectedVersion)
        throw new EditorialError(409, 'Content changed; reload before saving');
      if (r.status !== 'DRAFT')
        throw new EditorialError(
          409,
          'Create a new draft before editing a submitted revision',
        );
      await tx.editorialSource.deleteMany({ where: { revisionId: r.id } });
      await tx.editorialEntityReference.deleteMany({
        where: { revisionId: r.id },
      });
      await tx.editorialRevision.update({
        where: { id: r.id },
        data: { ...this.bodyData(data.body), reviewerId: null },
      });
      await this.evidence(tx, r.id, data.body, doc.contentItem.primaryEntityId);
      await tx.editorialDocument.update({
        where: { id },
        data: { version: { increment: 1 } },
      });
      await this.audit(tx, actor, 'editorial.saved', id, r.id);
    });
    return this.getAdmin(actor, id);
  }
  async action(actor: CmsActor, id: string, input: unknown) {
    actor = await this.actor(actor);
    const { action, expectedVersion } = z
      .object({
        action: z.enum([
          'submit',
          'approve',
          'publish',
          'return',
          'new-draft',
          'withdraw',
        ]),
        expectedVersion: z.number().int(),
      })
      .strict()
      .parse(input);
    await this.transaction(async (tx) => {
      const doc = await tx.editorialDocument.findUnique({
        where: { id },
        include: {
          currentRevision: { include: revisionInclude },
          contentItem: { include: { entity: true } },
        },
      });
      if (!doc?.currentRevision)
        throw new EditorialError(404, 'Content not found');
      if (doc.version !== expectedVersion)
        throw new EditorialError(
          409,
          'Content changed; reload before continuing',
        );
      const r = doc.currentRevision;
      if (action === 'withdraw') {
        requireRole(actor, 'EDITOR');
        await tx.editorialDocument.update({
          where: { id },
          data: { publishedRevisionId: null, version: { increment: 1 } },
        });
        await tx.entityRegistry.update({
          where: { id },
          data: { status: 'WITHDRAWN' },
        });
        await this.audit(tx, actor, 'editorial.withdrawn', id, r.id);
        return;
      }
      const body = {
        title: r.title,
        summary: r.summary,
        seoTitle: r.seoTitle,
        metaDescription: r.metaDescription,
        blocks: r.blocks,
        heroMediaId: r.heroMediaId,
        lastVerified: r.lastVerified?.toISOString() ?? null,
        sourceIds: r.sources.map((s) => s.sourceId),
        canonicalIds: r.references.map((x) => x.entityId),
      };
      const validated = editorialBodySchema.parse(body);
      if (action === 'new-draft') {
        if (!canEdit(actor, r.authorId))
          throw new EditorialError(403, 'Permission denied');
        if (r.status !== 'PUBLISHED')
          throw new EditorialError(
            409,
            'Return a review or approval to draft instead',
          );
        const next = await tx.editorialRevision.create({
          data: {
            documentId: id,
            number: r.number + 1,
            authorId: actor.id,
            ...this.bodyData(validated),
            lastVerified: null,
          },
        });
        await this.evidence(
          tx,
          next.id,
          validated,
          doc.contentItem.primaryEntityId,
        );
        await tx.editorialDocument.update({
          where: { id },
          data: { currentRevisionId: next.id, version: { increment: 1 } },
        });
        await this.audit(tx, actor, 'editorial.draft-created', id, next.id);
        return;
      }
      const status = assertTransition(r.status, action, actor, r.authorId);
      if (action === 'submit' || action === 'approve' || action === 'publish')
        readyForReview(validated);
      if (action === 'approve' || action === 'publish') {
        if (!r.lastVerified)
          throw new EditorialError(422, 'Set last verified before approval');
        if (
          r.sources.some(
            (s) =>
              s.source.retiredAt ||
              s.source.sourceType === 'DEVELOPMENT_FIXTURE',
          )
        )
          throw new EditorialError(
            422,
            'Development or retired sources cannot be approved',
          );
      }
      if (action === 'publish') {
        if (!r.heroMediaId)
          throw new EditorialError(422, 'Choose hero media before publishing');
        const referenced = await tx.entityRegistry.findMany({
          where: {
            id: {
              in: referenceIds(validated, doc.contentItem.primaryEntityId),
            },
          },
          include: { primarySource: true },
        });
        if (
          referenced.some(
            (e) =>
              e.status !== 'PUBLISHED' ||
              e.deletedAt ||
              !e.lastVerified ||
              !e.primarySource ||
              e.primarySource.retiredAt ||
              e.primarySource.sourceType === 'DEVELOPMENT_FIXTURE',
          )
        )
          throw new EditorialError(
            422,
            'Canonical references must be independently verified and published',
          );
        await this.ensureTemplate(tx, doc.contentItem.type, validated);
      }
      await tx.editorialRevision.update({
        where: { id: r.id },
        data: {
          status,
          reviewerId:
            action === 'approve'
              ? actor.id
              : action === 'return'
                ? null
                : r.reviewerId,
          publishedAt: action === 'publish' ? new Date() : r.publishedAt,
        },
      });
      await tx.editorialDocument.update({
        where: { id },
        data: {
          version: { increment: 1 },
          ...(action === 'publish'
            ? {
                publishedRevisionId: r.id,
                firstPublishedAt: doc.firstPublishedAt ?? new Date(),
              }
            : {}),
        },
      });
      if (action === 'publish') {
        await tx.entityRegistry.update({
          where: { id },
          data: {
            status: 'PUBLISHED',
            name: r.title,
            primarySourceId: r.sources[0]!.sourceId,
            lastVerified: r.lastVerified,
          },
        });
        await tx.contentItem.update({
          where: { id },
          data: { publishedAt: new Date() },
        });
      }
      await this.audit(tx, actor, `editorial.${action}`, id, r.id);
    });
    return this.getAdmin(actor, id);
  }
  private async ensureTemplate(
    tx: Prisma.TransactionClient,
    type: string,
    body: EditorialBody,
  ) {
    const assignment = await tx.templateAssignment.findFirst({
      where: { type: type as (typeof editorialTypes)[number] },
      include: { template: true },
    });
    if (
      !assignment ||
      body.blocks.some(
        (b) => !assignment.template.allowedBlocks.includes(b.type),
      )
    )
      throw new EditorialError(
        422,
        'Selected website template does not support this content',
      );
  }
  async getPublished(
    slug: string,
    locale = 'en',
    reader: Prisma.TransactionClient = this.db,
  ) {
    const doc = await reader.editorialDocument.findFirst({
      where: {
        contentItem: {
          entity: { slug, locale, status: 'PUBLISHED', deletedAt: null },
        },
      },
      include: docInclude,
    });
    const r = doc?.publishedRevision;
    if (!doc || !r) throw new EditorialError(404, 'Content not found');
    if (
      r.sources.some(
        (s) =>
          s.source.retiredAt || s.source.sourceType === 'DEVELOPMENT_FIXTURE',
      ) ||
      r.references.some(
        (x) =>
          x.entity.status !== 'PUBLISHED' ||
          x.entity.deletedAt ||
          !x.entity.primarySource ||
          x.entity.primarySource.retiredAt ||
          x.entity.primarySource.sourceType === 'DEVELOPMENT_FIXTURE',
      ) ||
      r.heroMedia?.deletedAt
    )
      throw new EditorialError(404, 'Content not found');
    const media = await reader.mediaAsset.findMany({
      where: {
        id: {
          in: mediaIds({
            heroMediaId: r.heroMediaId,
            blocks: r.blocks,
          } as EditorialBody),
        },
        deletedAt: null,
      },
      select: { id: true, width: true, height: true, alt: true, credit: true },
    });
    return {
      id: doc.id,
      type: doc.contentItem.type,
      slug,
      locale,
      primaryEntityId: doc.contentItem.primaryEntityId,
      revision: r.number,
      title: r.title,
      summary: r.summary,
      seoTitle: r.seoTitle,
      metaDescription: r.metaDescription,
      blocks: r.blocks,
      author: r.author,
      reviewer: r.reviewer,
      sources: r.sources.map((s) => ({
        id: s.source.id,
        title: s.source.title,
        url: s.source.url,
        publisher: s.source.publisher,
        accessedAt: s.source.accessedAt,
      })),
      canonicalEntities: r.references.map((x) => ({
        id: x.entity.id,
        kind: x.entity.kind,
        name: x.entity.name,
        slug: x.entity.slug,
      })),
      firstPublished: doc.firstPublishedAt,
      lastUpdated: r.updatedAt,
      lastVerified: r.lastVerified,
      heroMedia: r.heroMedia ? media.find((m) => m.id === r.heroMediaId) : null,
      media,
    };
  }
  async references(actor: CmsActor) {
    await this.actor(actor);
    return {
      entities: await this.db.entityRegistry.findMany({
        where: {
          kind: { not: 'CONTENT_ITEM' },
          deletedAt: null,
          status: { not: 'WITHDRAWN' },
        },
        select: {
          id: true,
          kind: true,
          name: true,
          slug: true,
          status: true,
          geoEntity: { select: { type: true } },
        },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      sources: await this.db.sourceRecord.findMany({
        where: { retiredAt: null },
        orderBy: { title: 'asc' },
        take: 200,
      }),
    };
  }
  async staff(actor: CmsActor) {
    requireRole(await this.actor(actor), 'EDITOR');
    return this.db.staffAccount.findMany({
      where: { active: true },
      select: { id: true, displayName: true, roles: true },
    });
  }
  async sources(actor: CmsActor, input: unknown) {
    actor = await this.actor(actor);
    requireRole(actor, 'EDITOR');
    const data = z
      .object({
        title: z.string().min(3).max(200),
        url: z
          .url()
          .refine((v) => ['http:', 'https:'].includes(new URL(v).protocol)),
        publisher: z.string().min(2).max(150),
        accessedAt: z.iso.datetime(),
        sourceType: z.enum([
          'OFFICIAL',
          'EDITORIAL',
          'FIELD_OBSERVATION',
          'DATASET',
        ]),
      })
      .strict()
      .parse(input);
    return this.transaction(async (tx) => {
      const source = await tx.sourceRecord.create({
        data: {
          ...data,
          accessedAt: new Date(data.accessedAt),
          sourceKey: `editorial:${randomUUID()}`,
        },
      });
      await this.audit(tx, actor, 'source.created', source.id);
      return source;
    });
  }
  async presentation() {
    const settings = await this.db.sitePresentation.findUnique({
      where: { id: 'website' },
      include: {
        theme: {
          include: {
            logoMedia: {
              select: { id: true, width: true, height: true, alt: true },
            },
          },
        },
      },
    });
    const assignments = await this.db.templateAssignment.findMany({
      include: { template: true },
    });
    return { settings, assignments };
  }
  async themes(actor: CmsActor) {
    await this.actor(actor);
    return this.db.siteTheme.findMany({ orderBy: { name: 'asc' } });
  }
  async templates(actor: CmsActor) {
    await this.actor(actor);
    return this.db.siteTemplate.findMany({ orderBy: { name: 'asc' } });
  }
  async saveTheme(actor: CmsActor, input: unknown) {
    actor = await this.actor(actor);
    requireRole(actor, 'ADMINISTRATOR');
    const data = z
      .object({
        id: z.uuid().optional(),
        expectedVersion: z.number().int().optional(),
        name: z.string().min(3).max(100),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        tokens: themeTokensSchema,
        logoMediaId: z.uuid().nullable(),
      })
      .strict()
      .parse(input);
    validateTheme(data.tokens);
    return this.transaction(async (tx) => {
      const existing = data.id
        ? await tx.siteTheme.findUnique({ where: { id: data.id } })
        : null;
      if (data.id && (!existing || existing.version !== data.expectedVersion))
        throw new EditorialError(409, 'Theme changed; reload');
      if (
        data.logoMediaId &&
        !(await tx.mediaAsset.findFirst({
          where: { id: data.logoMediaId, deletedAt: null },
        }))
      )
        throw new EditorialError(422, 'Choose active logo media');
      const theme = data.id
        ? await tx.siteTheme.update({
            where: { id: data.id },
            data: {
              name: data.name,
              slug: data.slug,
              tokens: data.tokens,
              logoMediaId: data.logoMediaId,
              version: { increment: 1 },
            },
          })
        : await tx.siteTheme.create({
            data: {
              name: data.name,
              slug: data.slug,
              tokens: data.tokens,
              logoMediaId: data.logoMediaId,
            },
          });
      await this.audit(tx, actor, 'theme.saved', theme.id);
      return theme;
    });
  }
  async saveTemplate(actor: CmsActor, input: unknown) {
    actor = await this.actor(actor);
    requireRole(actor, 'ADMINISTRATOR');
    const data = z
      .object({
        id: z.uuid().optional(),
        expectedVersion: z.number().int().optional(),
        name: z.string().min(3).max(100),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        layout: z.enum(['EDITORIAL', 'MAGAZINE', 'COMPACT']),
        allowedBlocks: z.array(z.enum(blockTypes)).min(1),
      })
      .strict()
      .parse(input);
    return this.transaction(async (tx) => {
      if (data.id) {
        const existing = await tx.siteTemplate.findUnique({
          where: { id: data.id },
        });
        if (!existing || existing.version !== data.expectedVersion)
          throw new EditorialError(409, 'Template changed; reload');
        const assignments = await tx.templateAssignment.findMany({
          where: { templateId: data.id },
        });
        await this.templateCompatibility(
          tx,
          assignments.map((a) => a.type),
          data.allowedBlocks,
        );
      }
      const value = {
        name: data.name,
        slug: data.slug,
        layout: data.layout,
        allowedBlocks: data.allowedBlocks,
      };
      const template = data.id
        ? await tx.siteTemplate.update({
            where: { id: data.id },
            data: { ...value, version: { increment: 1 } },
          })
        : await tx.siteTemplate.create({ data: value });
      await this.audit(tx, actor, 'template.saved', template.id);
      return template;
    });
  }
  private async templateCompatibility(
    tx: Prisma.TransactionClient,
    types: string[],
    allowed: string[],
  ) {
    const docs = await tx.editorialDocument.findMany({
      where: {
        contentItem: {
          type: { in: types as (typeof editorialTypes)[number][] },
        },
        publishedRevisionId: { not: null },
      },
      include: { publishedRevision: true },
    });
    if (
      docs.some((d) =>
        (d.publishedRevision!.blocks as ContentBlocks).some(
          (b) => !allowed.includes(b.type),
        ),
      )
    )
      throw new EditorialError(
        422,
        'Template must support blocks in existing published content',
      );
  }
  async configure(actor: CmsActor, input: unknown) {
    actor = await this.actor(actor);
    requireRole(actor, 'ADMINISTRATOR');
    const data = z
      .object({
        themeId: z.uuid(),
        expectedVersion: z.number().int(),
        assignments: z
          .array(
            z
              .object({ type: z.enum(editorialTypes), templateId: z.uuid() })
              .strict(),
          )
          .length(8),
      })
      .strict()
      .parse(input);
    if (new Set(data.assignments.map((a) => a.type)).size !== 8)
      throw new EditorialError(
        422,
        'Assign each editorial content type exactly once',
      );
    await this.transaction(async (tx) => {
      const setting = await tx.sitePresentation.findUnique({
        where: { id: 'website' },
      });
      if (!setting || setting.version !== data.expectedVersion)
        throw new EditorialError(409, 'Presentation changed; reload');
      if (!(await tx.siteTheme.findUnique({ where: { id: data.themeId } })))
        throw new EditorialError(422, 'Theme not found');
      for (const a of data.assignments) {
        const t = await tx.siteTemplate.findUnique({
          where: { id: a.templateId },
        });
        if (!t) throw new EditorialError(422, 'Template not found');
        await this.templateCompatibility(tx, [a.type], t.allowedBlocks);
        await tx.templateAssignment.upsert({
          where: { type: a.type },
          create: a,
          update: { templateId: a.templateId },
        });
      }
      await tx.sitePresentation.update({
        where: { id: 'website' },
        data: { themeId: data.themeId, version: { increment: 1 } },
      });
      await this.audit(tx, actor, 'presentation.activated', 'website');
    });
    return this.presentation();
  }
}
type ContentBlocks = Array<{ type: string }>;
