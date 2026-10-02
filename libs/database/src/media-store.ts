import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp, { type OutputInfo } from 'sharp';
import { EditorialError, type CmsActor } from '@visitspakistan/domain';
import type { PrismaClient } from './generated/client';
export class MediaStore {
  constructor(
    private readonly db: PrismaClient,
    private readonly root: string,
  ) {}
  async upload(actor: CmsActor, file: Buffer, alt: string, credit: string) {
    if (
      !actor.roles.includes('CONTRIBUTOR') &&
      !actor.roles.includes('EDITOR') &&
      !actor.roles.includes('ADMINISTRATOR')
    )
      throw new EditorialError(403, 'Permission denied');
    if (
      file.length > 8 * 1024 * 1024 ||
      !alt.trim() ||
      alt.length > 300 ||
      !credit.trim() ||
      credit.length > 300
    )
      throw new EditorialError(
        422,
        'Add alt text and rights attribution; maximum image size is 8 MB',
      );
    let converted: { data: Buffer; info: OutputInfo };
    try {
      const input = sharp(file, {
        limitInputPixels: 40000000,
        animated: false,
      });
      const metadata = await input.metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
        (metadata.pages ?? 1) > 1
      )
        throw new Error();
      converted = await input
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new EditorialError(
        422,
        'Upload a valid static JPEG, PNG or WebP image',
      );
    }
    const id = randomUUID();
    const storageKey = `${id}.webp`;
    await mkdir(this.root, { recursive: true });
    await writeFile(resolve(this.root, storageKey), converted.data, {
      flag: 'wx',
      mode: 0o600,
    });
    try {
      return await this.db.$transaction(async (tx) => {
        const asset = await tx.mediaAsset.create({
          data: {
            id,
            storageKey,
            mime: 'image/webp',
            width: converted.info.width,
            height: converted.info.height,
            sha256: createHash('sha256').update(converted.data).digest('hex'),
            alt: alt.trim(),
            credit: credit.trim(),
            uploadedById: actor.id,
          },
        });
        await tx.cmsAudit.create({
          data: { actorId: actor.id, action: 'media.uploaded', resourceId: id },
        });
        return asset;
      });
    } catch (e) {
      await unlink(resolve(this.root, storageKey));
      throw e;
    }
  }
  async list() {
    return this.db.mediaAsset.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  async read(id: string, publicOnly: boolean) {
    const asset = await this.db.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) throw new EditorialError(404, 'Media not found');
    if (publicOnly) {
      const docs = await this.db.editorialDocument.findMany({
        where: {
          publishedRevisionId: { not: null },
          contentItem: { entity: { status: 'PUBLISHED', deletedAt: null } },
        },
        include: {
          publishedRevision: {
            include: {
              references: {
                include: { entity: { include: { primarySource: true } } },
              },
              sources: { include: { source: true } },
            },
          },
        },
      });
      const used = docs.some((d) => {
        const r = d.publishedRevision!;
        return (
          !r.sources.some(
            (s) =>
              s.source.retiredAt ||
              s.source.sourceType === 'DEVELOPMENT_FIXTURE',
          ) &&
          !r.references.some(
            (x) =>
              x.entity.status !== 'PUBLISHED' ||
              x.entity.deletedAt ||
              !x.entity.primarySource ||
              x.entity.primarySource?.retiredAt ||
              x.entity.primarySource?.sourceType === 'DEVELOPMENT_FIXTURE',
          ) &&
          (r.heroMediaId === id ||
            (r.blocks as Array<{ type: string; mediaId?: string }>).some(
              (b) => b.type === 'image' && b.mediaId === id,
            ))
        );
      });
      const theme = await this.db.sitePresentation.findFirst({
        where: { theme: { logoMediaId: id } },
      });
      if (!used && !theme) throw new EditorialError(404, 'Media not found');
    }
    try {
      return {
        asset,
        bytes: await readFile(resolve(this.root, asset.storageKey)),
      };
    } catch {
      throw new EditorialError(404, 'Media file unavailable');
    }
  }
}
