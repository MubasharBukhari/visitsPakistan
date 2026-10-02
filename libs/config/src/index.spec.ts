import { databaseUrl, parseServerConfig } from './index';
const env = {
  DB_HOST: 'localhost',
  DB_USER: 'test',
  DB_PASS: 'a@:/?#',
  DB_NAME: 'platform',
  REDIS_URL: 'redis://localhost:6379',
  OPENSEARCH_URL: 'http://localhost:9200',
  WEB_ORIGIN: 'http://localhost:3000',
  CMS_ORIGIN: 'http://localhost:3001',
};
test('encodes database credentials without changing values', () => {
  const url = new URL(databaseUrl(parseServerConfig(env)));
  expect(decodeURIComponent(url.password)).toBe(env.DB_PASS);
});
test('reports invalid field names without values or secrets', () => {
  expect(() =>
    parseServerConfig({ ...env, DB_PORT: 'secret-invalid-value' }),
  ).toThrow('Invalid server configuration: DB_PORT');
  expect(() =>
    parseServerConfig({
      ...env,
      REDIS_URL: 'https://private:secret@localhost',
    }),
  ).toThrow('Invalid server configuration: REDIS_URL');
});

test('empty container URL uses DB fields and explicit URL takes precedence', () => {
  expect(
    new URL(
      databaseUrl(
        parseServerConfig({
          ...env,
          DATABASE_URL: '',
          DB_HOST: 'host.docker.internal',
          DB_PORT: '5433',
        }),
      ),
    ).hostname,
  ).toBe('host.docker.internal');
  const override = 'postgres://test:local@localhost:5433/platform';
  expect(
    databaseUrl(parseServerConfig({ ...env, DATABASE_URL: override })),
  ).toBe(override);
});
