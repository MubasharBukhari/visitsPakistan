import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../../apps/api/src/app';
import { createGraphClient, EditorialStore } from '@visitspakistan/database';
import {
  encryptMfa,
  hashPassword,
  generateSecret,
  generate,
  tokenHash,
} from '@visitspakistan/auth';
import { databaseUrl, parseServerConfig } from '@visitspakistan/config';
import {
  brandTokens,
  blockTypes,
  editorialTypes,
  type CmsActor,
  type EditorialBody,
} from '@visitspakistan/domain';
import { seedKnowledgeGraph } from '../../libs/database/src/seed';
import { stubProbe } from '@visitspakistan/testing';
const base = parseServerConfig(process.env);
const testName = process.env.DB_TEST_NAME;
const url = new URL(databaseUrl(base));
if (!testName?.endsWith('_test') || testName === url.pathname.slice(1))
  throw new Error('Isolated test database required');
url.pathname = `/${testName}`;
const key = randomBytes(32).toString('hex');
const db = createGraphClient(url.toString());
const store = new EditorialStore(db);
let app: INestApplication;
let root: string;
let author: CmsActor;
let editor: CmsActor;
let authorToken: string;
let editorToken: string;
let adminToken: string;
let sourceId: string;
let heroId: string;
let templateId: string;
const created: string[] = [];
type Doc = {
  id: string;
  version: number;
  currentRevision: {
    id: string;
    status: string;
    number: number;
    title: string;
  };
  publishedRevision: { id: string; number: number } | null;
};
const contentBody = (): EditorialBody => ({
  title: 'Isolated Hunza editorial test',
  summary: 'A synthetic test story, never served by the development database.',
  seoTitle: 'Hunza test editorial',
  metaDescription:
    'A complete and useful test description for validating editorial publication through the isolated API.',
  blocks: [
    {
      type: 'paragraph',
      text: 'An isolated editorial test narrative with no canonical facts.',
    },
  ],
  sourceIds: [sourceId],
  canonicalIds: [],
  heroMediaId: heroId,
  lastVerified: new Date(Date.now() - 60000).toISOString(),
});
async function account(role: 'CONTRIBUTOR' | 'EDITOR' | 'ADMINISTRATOR') {
  const password = randomBytes(20).toString('hex');
  const secret = generateSecret();
  const roles =
    role === 'ADMINISTRATOR' ? (['ADMINISTRATOR', 'EDITOR'] as const) : [role];
  const a = await db.staffAccount.create({
    data: {
      email: `test-${randomUUID()}@visitspakistan.test`,
      displayName: `Test ${role}`,
      roles: [...roles],
      passwordHash: await hashPassword(password),
      mfaSecret: encryptMfa(secret, key),
    },
  });
  const response = await request(app.getHttpServer())
    .post('/api/v1/admin/auth/login')
    .send({ email: a.email, password, otp: await generate({ secret }) })
    .expect(201);
  return {
    actor: { id: a.id, displayName: a.displayName, roles: a.roles },
    token: response.body.token as string,
    credentials: { email: a.email, password, otp: await generate({ secret }) },
  };
}
async function create(
  token = authorToken,
  type = 'TRAVEL_STORY',
  body = contentBody(),
  primaryEntityId: string | null = null,
) {
  const slug = `test-editorial-${randomUUID()}`;
  const res = await request(app.getHttpServer())
    .post('/api/v1/admin/content')
    .auth(token, { type: 'bearer' })
    .send({ type, slug, locale: 'en', primaryEntityId, body })
    .expect(201);
  created.push(res.body.id);
  return { doc: res.body as Doc, slug };
}
async function action(
  doc: Doc,
  action: string,
  token = editorToken,
  expected = 201,
) {
  return request(app.getHttpServer())
    .post(`/api/v1/admin/content/${doc.id}/actions`)
    .auth(token, { type: 'bearer' })
    .send({ action, expectedVersion: doc.version })
    .expect(expected);
}
async function publish(doc: Doc) {
  let r = await action(doc, 'submit', authorToken);
  r = await action(r.body, 'approve');
  return (await action(r.body, 'publish')).body as Doc;
}
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'vp-cms-test-'));
  await seedKnowledgeGraph(db);
  app = await createApplication(
    {
      ...base,
      DATABASE_URL: url.toString(),
      DB_NAME: testName!,
      CMS_MFA_KEY: key,
      MEDIA_ROOT: root,
    },
    [stubProbe('database', true)],
    false,
  );
  await app.init();
  const a = await account('CONTRIBUTOR');
  author = a.actor;
  authorToken = a.token;
  const e = await account('EDITOR');
  editor = e.actor;
  editorToken = e.token;
  const ad = await account('ADMINISTRATOR');
  adminToken = ad.token;
  const source = await db.sourceRecord.create({
    data: {
      sourceKey: `cms-test:${randomUUID()}`,
      title: 'Synthetic editorial test source',
      publisher: 'Isolated integration test',
      sourceType: 'EDITORIAL',
      accessedAt: new Date(),
    },
  });
  sourceId = source.id;
  const image = await sharp({
    create: { width: 20, height: 10, channels: 3, background: '#0d5c3a' },
  })
    .png()
    .toBuffer();
  const upload = await request(app.getHttpServer())
    .post('/api/v1/admin/media')
    .auth(adminToken, { type: 'bearer' })
    .field('alt', 'Synthetic test image')
    .field('credit', 'Integration fixture')
    .field('rightsConfirmed', 'true')
    .attach('file', image, { filename: 'test.png', contentType: 'image/png' })
    .expect(201);
  heroId = upload.body.id;
  const template = await db.siteTemplate.create({
    data: {
      slug: `test-layout-${randomUUID()}`,
      name: 'Test editorial layout',
      layout: 'EDITORIAL',
      allowedBlocks: [...blockTypes],
    },
  });
  templateId = template.id;
  const theme = await db.siteTheme.create({
    data: {
      slug: `test-theme-${randomUUID()}`,
      name: 'Test Majestic Indus',
      tokens: brandTokens,
    },
  });
  await db.sitePresentation.upsert({
    where: { id: 'website' },
    create: { id: 'website', themeId: theme.id },
    update: { themeId: theme.id },
  });
  for (const type of editorialTypes)
    await db.templateAssignment.upsert({
      where: { type },
      create: { type, templateId },
      update: { templateId },
    });
}, 30000);
afterAll(async () => {
  if (created.length) {
    await db.editorialDocument.updateMany({
      where: { id: { in: created } },
      data: { publishedRevisionId: null },
    });
    await db.entityRegistry.updateMany({
      where: { id: { in: created } },
      data: { status: 'WITHDRAWN' },
    });
  }
  if (app) await app.close();
  await db.$disconnect();
  if (root) await rm(root, { recursive: true, force: true });
});
test('anonymous callers cannot read drafts or administrative data; author retrieval works', async () => {
  const { doc, slug } = await create();
  await request(app.getHttpServer()).get(`/api/v1/content/${slug}`).expect(404);
  await request(app.getHttpServer())
    .get(`/api/v1/admin/content/${doc.id}`)
    .expect(401);
  const res = await request(app.getHttpServer())
    .get(`/api/v1/admin/content/${doc.id}`)
    .auth(authorToken, { type: 'bearer' })
    .expect(200);
  expect(res.body.currentRevision.title).toBe(contentBody().title);
  expect(res.body.currentRevision.author).not.toHaveProperty('passwordHash');
});
test('draft → review → approved → published retrieval preserves SEO, author, media and sources', async () => {
  const { doc, slug } = await create();
  const published = await publish(doc);
  expect(published.publishedRevision?.number).toBe(1);
  const response = await request(app.getHttpServer())
    .get(`/api/v1/content/${slug}`)
    .expect(200);
  expect(response.body).toMatchObject({
    revision: 1,
    title: contentBody().title,
    seoTitle: contentBody().seoTitle,
    author: { id: author.id },
    reviewer: { id: editor.id },
    heroMedia: { id: heroId },
  });
  expect(response.body.firstPublished).toBeTruthy();
  expect(response.body.sources[0].id).toBe(sourceId);
  await request(app.getHttpServer())
    .get(`/api/v1/media/${heroId}`)
    .expect(200)
    .expect('Content-Type', /image\/webp/);
  expect(await db.cmsAudit.count({ where: { resourceId: doc.id } })).toBe(4);
  expect(await db.contentOutbox.count({ where: { resourceId: doc.id } })).toBe(
    4,
  );
});
test('a new editable revision leaves published retrieval unchanged and resets verification', async () => {
  const { doc, slug } = await create();
  const published = await publish(doc);
  const draft = (await action(published, 'new-draft')).body as Doc;
  expect(draft.currentRevision.number).toBe(2);
  const data = await db.editorialRevision.findUniqueOrThrow({
    where: { id: draft.currentRevision.id },
  });
  expect(data.lastVerified).toBeNull();
  const edited = await request(app.getHttpServer())
    .put(`/api/v1/admin/content/${doc.id}`)
    .auth(editorToken, { type: 'bearer' })
    .send({
      expectedVersion: draft.version,
      body: { ...contentBody(), title: 'Changed draft, not yet public' },
    })
    .expect(200);
  await request(app.getHttpServer())
    .put(`/api/v1/admin/content/${doc.id}`)
    .auth(editorToken, { type: 'bearer' })
    .send({ expectedVersion: draft.version, body: contentBody() })
    .expect(409);
  const publicRead = await request(app.getHttpServer())
    .get(`/api/v1/content/${slug}`)
    .expect(200);
  expect(publicRead.body.title).toBe(contentBody().title);
  await action(edited.body, 'withdraw');
  await request(app.getHttpServer()).get(`/api/v1/content/${slug}`).expect(404);
});
test('RBAC rejects self-review, another contributor and unauthorized theme changes', async () => {
  const { doc } = await create(editorToken);
  const r = await action(doc, 'submit', editorToken);
  await action(r.body, 'approve', editorToken, 403);
  const another = await account('CONTRIBUTOR');
  await request(app.getHttpServer())
    .get(`/api/v1/admin/content/${doc.id}`)
    .auth(another.token, { type: 'bearer' })
    .expect(403);
  await request(app.getHttpServer())
    .post('/api/v1/admin/themes')
    .auth(authorToken, { type: 'bearer' })
    .send({
      name: 'Forbidden theme',
      slug: 'forbidden',
      tokens: brandTokens,
      logoMediaId: null,
    })
    .expect(403);
  await action(r.body, 'approve', adminToken);
});
test('published revision bodies and evidence cannot be mutated through direct SQL', async () => {
  const { doc } = await create();
  const published = await publish(doc);
  await expect(
    db.editorialRevision.update({
      where: { id: published.currentRevision.id },
      data: { title: 'Tampered' },
    }),
  ).rejects.toThrow();
  await expect(
    db.editorialSource.deleteMany({
      where: { revisionId: published.currentRevision.id },
    }),
  ).rejects.toThrow();
  await expect(
    db.cmsAudit.deleteMany({ where: { resourceId: doc.id } }),
  ).rejects.toThrow();
});
test('fixture provenance and unpublished canonical entities block approval/publication', async () => {
  const source = await db.sourceRecord.create({
    data: {
      sourceKey: randomUUID(),
      title: 'Development fixture',
      publisher: 'Test',
      sourceType: 'DEVELOPMENT_FIXTURE',
      accessedAt: new Date(),
    },
  });
  const { doc } = await create(authorToken, 'TRAVEL_STORY', {
    ...contentBody(),
    sourceIds: [source.id],
  });
  const review = (await action(doc, 'submit', authorToken)).body;
  await action(review, 'approve', editorToken, 422);
  const id = randomUUID();
  await db.$transaction(async (tx) => {
    await tx.entityRegistry.create({
      data: {
        id,
        kind: 'GEO_ENTITY',
        name: 'Unverified test destination',
        slug: `test-${id}`,
        geoEntity: {
          create: {
            type: 'DESTINATION',
            parentId: '00000000-0000-4000-8000-000000000001',
          },
        },
      },
    });
  });
  const linked = await create(
    authorToken,
    'DESTINATION_EDITORIAL',
    { ...contentBody(), canonicalIds: [id] },
    id,
  );
  let r = await action(linked.doc, 'submit', authorToken);
  r = await action(r.body, 'approve');
  await action(r.body, 'publish', editorToken, 422);
});
test('nine editorial types exist and missing typed canonical references are rejected', async () => {
  expect(editorialTypes).toHaveLength(9);
  await request(app.getHttpServer())
    .post('/api/v1/admin/content')
    .auth(authorToken, { type: 'bearer' })
    .send({
      type: 'ATTRACTION_EDITORIAL',
      slug: `test-${randomUUID()}`,
      locale: 'en',
      primaryEntityId: null,
      body: contentBody(),
    })
    .expect(422);
  const { doc } = await create(authorToken, 'FOOD_GUIDE');
  expect((await store.getAdmin(author, doc.id)).contentItem.type).toBe(
    'FOOD_GUIDE',
  );
});
test('theme contrast, template assignments and optimistic version conflicts are enforced', async () => {
  const theme = await request(app.getHttpServer())
    .post('/api/v1/admin/themes')
    .auth(adminToken, { type: 'bearer' })
    .send({
      name: 'API test theme',
      slug: `test-${randomUUID()}`,
      tokens: brandTokens,
      logoMediaId: null,
    })
    .expect(201);
  await request(app.getHttpServer())
    .post('/api/v1/admin/themes')
    .auth(adminToken, { type: 'bearer' })
    .send({
      id: theme.body.id,
      expectedVersion: 0,
      name: 'Stale theme',
      slug: theme.body.slug,
      tokens: brandTokens,
      logoMediaId: null,
    })
    .expect(409);
  await request(app.getHttpServer())
    .post('/api/v1/admin/themes')
    .auth(adminToken, { type: 'bearer' })
    .send({
      name: 'Bad contrast',
      slug: `test-${randomUUID()}`,
      tokens: { ...brandTokens, primary: '#FFFFFF' },
      logoMediaId: null,
    })
    .expect(422);
  const settings = await db.sitePresentation.findUniqueOrThrow({
    where: { id: 'website' },
  });
  await request(app.getHttpServer())
    .post('/api/v1/admin/presentation')
    .auth(adminToken, { type: 'bearer' })
    .send({
      themeId: theme.body.id,
      expectedVersion: settings.version,
      assignments: editorialTypes.map((type) => ({ type, templateId })),
    })
    .expect(201);
  expect(
    (await request(app.getHttpServer()).get('/api/v1/presentation').expect(200))
      .body.settings.themeId,
  ).toBe(theme.body.id);
});
test('staff MFA rejects replay and expired/revoked sessions immediately', async () => {
  const a = await account('CONTRIBUTOR');
  await request(app.getHttpServer())
    .post('/api/v1/admin/auth/login')
    .send(a.credentials)
    .expect(401);
  await db.staffSession.update({
    where: { tokenHash: tokenHash(a.token) },
    data: { lastSeenAt: new Date(Date.now() - 31 * 60000) },
  });
  await request(app.getHttpServer())
    .get('/api/v1/admin/auth/me')
    .auth(a.token, { type: 'bearer' })
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/admin/auth/logout')
    .auth(authorToken, { type: 'bearer' })
    .expect(201);
  await request(app.getHttpServer())
    .get('/api/v1/admin/auth/me')
    .auth(authorToken, { type: 'bearer' })
    .expect(401);
});
