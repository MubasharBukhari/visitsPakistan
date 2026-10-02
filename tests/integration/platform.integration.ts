import { createDatabaseProbe } from '@visitspakistan/database';
import { createCacheProbe } from '@visitspakistan/cache';
import { createSearchProbe } from '@visitspakistan/search';
import { databaseUrl, parseServerConfig } from '@visitspakistan/config';
import { createApplication } from '../../apps/api/src/app';
import request from 'supertest';
test('isolated migrated PostgreSQL/PostGIS, Redis and OpenSearch support ready HTTP', async () => {
  const name = process.env.DB_TEST_NAME;
  if (!name || !name.endsWith('_test') || name === process.env.DB_NAME)
    throw new Error('A separate DB_TEST_NAME ending in _test is required');
  const config = parseServerConfig({
    ...process.env,
    DATABASE_URL: undefined,
    DB_NAME: name,
  });
  const probes = [
    createDatabaseProbe(databaseUrl(config), config.DEPENDENCY_TIMEOUT_MS),
    createCacheProbe(config.REDIS_URL, config.DEPENDENCY_TIMEOUT_MS),
    createSearchProbe(config.OPENSEARCH_URL, config.DEPENDENCY_TIMEOUT_MS),
  ];
  const app = await createApplication(config, probes, false);
  try {
    await app.init();
    const response = await request(app.getHttpServer())
      .get('/ready')
      .expect(200);
    expect(response.body).toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up', opensearch: 'up' },
    });
  } finally {
    await app.close();
  }
});

test('PostGIS executes geography distance SQL in the isolated test database', async () => {
  const name = process.env.DB_TEST_NAME;
  if (!name || !name.endsWith('_test') || name === process.env.DB_NAME)
    throw new Error('Separate test database required');
  const config = parseServerConfig({
    ...process.env,
    DATABASE_URL: undefined,
    DB_NAME: name,
  });
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: databaseUrl(config),
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
  });
  try {
    const result = await pool.query<{ meters: number }>(
      'SELECT ST_Distance(ST_SetSRID(ST_Point(0,0),4326)::geography, ST_SetSRID(ST_Point(1,0),4326)::geography) AS meters',
    );
    expect(result.rows[0]?.meters).toBeGreaterThan(110000);
    expect(result.rows[0]?.meters).toBeLessThan(112000);
  } finally {
    await pool.end();
  }
});
