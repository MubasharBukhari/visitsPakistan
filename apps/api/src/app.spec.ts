import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { parseServerConfig } from '@visitspakistan/config';
import { stubProbe } from '@visitspakistan/testing';
import { createApplication } from './app';
const config = parseServerConfig({
  DB_HOST: 'localhost',
  DB_USER: 'fixture',
  DB_PASS: 'fixture',
  DB_NAME: 'platform',
  REDIS_URL: 'redis://localhost:6379',
  OPENSEARCH_URL: 'http://localhost:9200',
  WEB_ORIGIN: 'http://localhost:3000',
  CMS_ORIGIN: 'http://localhost:3001',
  SWAGGER_ENABLED: 'true',
  DEPENDENCY_TIMEOUT_MS: '100',
});
let app: INestApplication;
afterEach(async () => {
  await app.close();
});
test('liveness remains healthy while required database is unavailable; readiness fails safely', async () => {
  app = await createApplication(
    config,
    [stubProbe('database', true, false)],
    false,
  );
  await app.init();
  const live = await request(app.getHttpServer()).get('/health').expect(200);
  expect(live.body).toEqual({ status: 'ok', service: 'api' });
  expect(live.headers['x-request-id']).toBeDefined();
  const ready = await request(app.getHttpServer()).get('/ready').expect(503);
  expect(ready.body).toEqual({
    status: 'unavailable',
    checks: { database: 'down' },
  });
  expect(JSON.stringify(ready.body)).not.toContain('credential');
});
test('optional search/cache failure reports degraded without rejecting database-ready API', async () => {
  app = await createApplication(
    config,
    [
      stubProbe('database', true),
      stubProbe('redis', false, false),
      stubProbe('opensearch', false, false),
    ],
    false,
  );
  await app.init();
  const ready = await request(app.getHttpServer()).get('/ready').expect(200);
  expect(ready.body).toEqual({
    status: 'degraded',
    checks: { database: 'up', redis: 'down', opensearch: 'down' },
  });
});
test('healthy dependencies and generated OpenAPI agree on platform routes', async () => {
  app = await createApplication(config, [stubProbe('database', true)], false);
  await app.init();
  expect(
    (await request(app.getHttpServer()).get('/ready').expect(200)).body.status,
  ).toBe('ok');
  const spec = await request(app.getHttpServer())
    .get('/api/docs-json')
    .expect(200);
  expect(Object.keys(spec.body.paths)).toEqual(
    expect.arrayContaining([
      '/health',
      '/ready',
      '/api/v1/content/{slug}',
      '/api/v1/admin/content',
      '/api/v1/places/{slug}',
      '/api/v1/experiences/{slug}',
      '/api/v1/things-to-do',
      '/api/v1/search',
      '/api/v1/destinations',
      '/api/v1/destinations/{slug}',
      '/v1/destinations',
      '/v1/destinations/{slug}',
    ]),
  );
});
test('hanging probe is bounded and shutdown closes adapters', async () => {
  const close = jest.fn(async () => {});
  app = await createApplication(
    config,
    [
      {
        name: 'database',
        required: true,
        check: () => new Promise(() => {}),
        close,
      },
    ],
    false,
  );
  await app.init();
  await request(app.getHttpServer()).get('/ready').expect(503);
  await app.close();
  expect(close).toHaveBeenCalled();
});
