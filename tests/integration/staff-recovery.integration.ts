import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from '../../apps/api/src/app';
import { recoveryDelivery } from '../../apps/api/src/recovery-delivery';
import {
  createGraphClient,
  StaffPasswordRecovery,
} from '@visitspakistan/database';
import {
  hashPassword,
  encryptMfa,
  generateSecret,
  generate,
  tokenHash,
  verifyPassword,
} from '@visitspakistan/auth';
import { parseServerConfig, databaseUrl } from '@visitspakistan/config';
import { stubProbe } from '@visitspakistan/testing';
const base = parseServerConfig(process.env),
  url = new URL(databaseUrl(base));
if (
  !process.env.DB_TEST_NAME?.endsWith('_test') ||
  url.pathname.slice(1) === process.env.DB_TEST_NAME
)
  throw new Error('Isolated test database required');
url.pathname = '/' + process.env.DB_TEST_NAME;
const db = createGraphClient(url.toString()),
  key = randomBytes(32).toString('hex');
let app: INestApplication, root: string, recovery: StaffPasswordRecovery;
const ids: string[] = [];
async function fixture() {
  const secret = generateSecret();
  const account = await db.staffAccount.create({
    data: {
      email: `reset-${randomUUID()}@visitspakistan.test`,
      displayName: 'Recovery test',
      roles: ['EDITOR'],
      passwordHash: await hashPassword('old-test-password'),
      mfaSecret: encryptMfa(secret, key),
    },
  });
  ids.push(account.id);
  const sessionToken = randomBytes(32).toString('base64url');
  await db.staffSession.create({
    data: {
      staffId: account.id,
      tokenHash: tokenHash(sessionToken),
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  return { account, secret, sessionToken };
}
async function link(email: string) {
  await recovery.request(email);
  await recovery.processDelivery();
  for (const file of await readdir(root)) {
    const item = JSON.parse(await readFile(join(root, file), 'utf8'));
    if (item.to === email)
      return new URL(item.text.match(/https?:\/\/\S+/)[0]).hash.slice(7);
  }
  throw new Error('Missing private message');
}
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'vp-recovery-'));
  const config = {
    ...base,
    DATABASE_URL: url.toString(),
    DB_NAME: process.env.DB_TEST_NAME!,
    CMS_MFA_KEY: key,
    SMTP_HOST: undefined,
    SMTP_FROM: undefined,
    PASSWORD_RESET_DIR: root,
  };
  recovery = new StaffPasswordRecovery(db, key, recoveryDelivery(config));
  app = await createApplication(config, [stubProbe('test', true)]);
  await app.init();
});
afterAll(async () => {
  await app?.close();
  await db.staffPasswordReset.deleteMany({ where: { staffId: { in: ids } } });
  await db.staffSession.deleteMany({ where: { staffId: { in: ids } } });
  await db.staffAccount.updateMany({
    where: { id: { in: ids } },
    data: { active: false },
  });
  await db.$disconnect();
  await rm(root, { recursive: true, force: true });
});
test('request is generic, bounded, asynchronously delivered and never exposes a token', async () => {
  const f = await fixture();
  const a = await request(app.getHttpServer())
    .post('/api/v1/admin/auth/forgot-password')
    .send({ email: f.account.email })
    .expect(202);
  const b = await request(app.getHttpServer())
    .post('/api/v1/admin/auth/forgot-password')
    .send({ email: 'unknown@visitspakistan.test' })
    .expect(202);
  expect(a.body).toEqual(b.body);
  expect(a.headers['cache-control']).toBe('no-store');
  await recovery.request(f.account.email);
  expect(
    await db.staffPasswordReset.count({ where: { staffId: f.account.id } }),
  ).toBe(1);
  await recovery.processDelivery();
  const record = await db.staffPasswordReset.findFirstOrThrow({
    where: { staffId: f.account.id },
  });
  expect(record.encryptedToken).toBeNull();
  expect(record.deliveredAt).not.toBeNull();
});
test('reset needs fresh MFA, consumes once, revokes sessions and records secret-free audit', async () => {
  const f = await fixture(),
    token = await link(f.account.email),
    password = 'new-test-password-secure';
  const proof = await db.staffPasswordReset.findUniqueOrThrow({
    where: { tokenHash: tokenHash(token) },
  });
  expect(proof.tokenHash).not.toBe(token);
  const otp = await generate({ secret: f.secret });
  await request(app.getHttpServer())
    .post('/api/v1/admin/auth/reset-password')
    .send({ token, password, otp: otp === '000000' ? '111111' : '000000' })
    .expect(400);
  await request(app.getHttpServer())
    .post('/api/v1/admin/auth/reset-password')
    .send({ token, password, otp })
    .expect(200);
  await request(app.getHttpServer())
    .get('/api/v1/admin/auth/me')
    .auth(f.sessionToken, { type: 'bearer' })
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/admin/auth/reset-password')
    .send({ token, password, otp })
    .expect(400);
  const updated = await db.staffAccount.findUniqueOrThrow({
    where: { id: f.account.id },
  });
  expect(await verifyPassword(updated.passwordHash, password)).toBe(true);
  expect(await verifyPassword(updated.passwordHash, 'old-test-password')).toBe(
    false,
  );
  expect(updated.lastMfaStep).not.toBeNull();
  const audit = await db.cmsAudit.findFirstOrThrow({
    where: { actorId: f.account.id, action: 'staff.password_reset' },
  });
  expect(JSON.stringify(audit)).not.toContain(token);
  expect(audit.metadata).toEqual({});
  // Clock advancement avoids waiting for the next 30-second authenticator code.
  const fresh = await generate({
    secret: f.secret,
    epoch: Number(updated.lastMfaStep! + 1n) * 30,
  });
  await request(app.getHttpServer())
    .post('/api/v1/admin/auth/login')
    .send({ email: f.account.email, password, otp: fresh })
    .expect(201);
});
test('expired links and inactive staff cannot reset; pending links invalidate on password change', async () => {
  const f = await fixture(),
    token = await link(f.account.email),
    otp = await generate({ secret: f.secret });
  await db.staffPasswordReset.update({
    where: { tokenHash: tokenHash(token) },
    data: { expiresAt: new Date(Date.now() - 1) },
  });
  await expect(
    recovery.reset(token, 'new-test-password-secure', otp),
  ).rejects.toMatchObject({ status: 400 });
  await db.staffAccount.update({
    where: { id: f.account.id },
    data: { active: false, recoveryRequestedAt: null },
  });
  await recovery.request(f.account.email);
  expect(
    await db.staffPasswordReset.count({ where: { staffId: f.account.id } }),
  ).toBe(1);
});
test('concurrent reset consumers yield exactly one successful password change', async () => {
  const f = await fixture(),
    token = await link(f.account.email),
    otp = await generate({ secret: f.secret });
  const results = await Promise.allSettled([
    recovery.reset(token, 'concurrent-new-password-one', otp),
    recovery.reset(token, 'concurrent-new-password-two', otp),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    await db.cmsAudit.count({
      where: { actorId: f.account.id, action: 'staff.password_reset' },
    }),
  ).toBe(1);
});
test('delivery failures retain encrypted payload for retry; production never writes local messages', async () => {
  const f = await fixture();
  let fail = true;
  const delivered: string[] = [];
  const worker = new StaffPasswordRecovery(db, key, async (_email, token) => {
    if (fail) throw new Error('private SMTP failure');
    delivered.push(token);
  });
  await worker.request(f.account.email);
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await worker.processDelivery();
  spy.mockRestore();
  let proof = await db.staffPasswordReset.findFirstOrThrow({
    where: { staffId: f.account.id },
  });
  expect(proof.encryptedToken).not.toBeNull();
  fail = false;
  await db.staffPasswordReset.update({
    where: { id: proof.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await worker.processDelivery();
  proof = await db.staffPasswordReset.findUniqueOrThrow({
    where: { id: proof.id },
  });
  expect(proof.encryptedToken).toBeNull();
  expect(delivered).toHaveLength(1);
  expect(
    recoveryDelivery({
      ...base,
      NODE_ENV: 'production',
      SMTP_HOST: undefined,
      SMTP_FROM: undefined,
    }),
  ).toBeUndefined();
});

test('five wrong MFA attempts exhaust a link without modifying account credentials', async () => {
  const f = await fixture(),
    token = await link(f.account.email),
    otp = await generate({ secret: f.secret }),
    wrong = otp === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++)
    await expect(
      recovery.reset(token, 'new-test-password-secure', wrong),
    ).rejects.toMatchObject({ status: 400 });
  await expect(
    recovery.reset(token, 'new-test-password-secure', otp),
  ).rejects.toMatchObject({ status: 400 });
  expect(
    (await db.staffAccount.findUniqueOrThrow({ where: { id: f.account.id } }))
      .passwordHash,
  ).toBe(f.account.passwordHash);
});

test('API rejects weak passwords and throttles anonymous recovery attempts', async () => {
  const api = await createApplication(
    {
      ...base,
      DATABASE_URL: url.toString(),
      DB_NAME: process.env.DB_TEST_NAME!,
      CMS_MFA_KEY: key,
      SMTP_HOST: undefined,
      SMTP_FROM: undefined,
      PASSWORD_RESET_DIR: root,
    },
    [stubProbe('test', true)],
    false,
  );
  await api.init();
  try {
    await request(api.getHttpServer())
      .post('/api/v1/admin/auth/reset-password')
      .send({ token: 'x'.repeat(43), password: 'short', otp: '123456' })
      .expect(422);
    for (let i = 0; i < 9; i++)
      await request(api.getHttpServer())
        .post('/api/v1/admin/auth/forgot-password')
        .send({ email: 'unknown@example.test' })
        .expect(202);
    await request(api.getHttpServer())
      .post('/api/v1/admin/auth/forgot-password')
      .send({ email: 'unknown@example.test' })
      .expect(429);
  } finally {
    await api.close();
  }
});
