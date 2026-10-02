import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';
import { databaseUrl, parseServerConfig } from '../libs/config/src';
async function migrate() {
  const config = parseServerConfig(process.env);
  const pool = new Pool({
    connectionString: databaseUrl(config),
    connectionTimeoutMillis: config.DEPENDENCY_TIMEOUT_MS,
    query_timeout: config.DEPENDENCY_TIMEOUT_MS,
  });
  try {
    const extension = await pool.query(
      "SELECT name FROM pg_available_extensions WHERE name = 'postgis'",
    );
    if (extension.rowCount !== 1)
      throw new Error(
        'Install PostGIS for the PostgreSQL server on DB_HOST:DB_PORT before running migrations.',
      );
  } catch {
    console.error(
      'Database prerequisite failed: verify connectivity and install PostGIS for the active server version. No migration was attempted.',
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
  if (!process.exitCode) {
    const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      env: process.env,
    });
    process.exitCode = result.status ?? 1;
  }
}
migrate().catch(() => {
  console.error('Migration setup failed; verify server configuration');
  process.exitCode = 1;
});
