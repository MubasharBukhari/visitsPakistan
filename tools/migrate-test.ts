import 'dotenv/config';
import { spawnSync } from 'node:child_process';
const testName = process.env.DB_TEST_NAME;
if (
  !testName ||
  !/^[a-zA-Z_][a-zA-Z0-9_]*_test$/.test(testName) ||
  testName === process.env.DB_NAME
)
  throw new Error('DB_TEST_NAME must be a separate database ending in _test');
const testUrl = new URL(
  process.env.DATABASE_URL ??
    `postgresql://${encodeURIComponent(process.env.DB_USER ?? '')}:${encodeURIComponent(process.env.DB_PASS ?? '')}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'}/${process.env.DB_NAME ?? ''}`,
);
if (testUrl.pathname.slice(1) === testName)
  throw new Error('Test database must differ from DATABASE_URL database');
testUrl.pathname = `/${testName}`;
const result = spawnSync('pnpm', ['exec', 'tsx', 'tools/migrate.ts'], {
  stdio: 'inherit',
  env: { ...process.env, DB_NAME: testName, DATABASE_URL: testUrl.toString() },
});
process.exit(result.status ?? 1);
