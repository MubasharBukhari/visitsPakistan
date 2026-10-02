import { parseServerConfig, databaseUrl } from '@visitspakistan/config';
import { createDatabaseProbe } from '@visitspakistan/database';
import { createCacheProbe } from '@visitspakistan/cache';
import { createSearchProbe } from '@visitspakistan/search';
import { createApplication } from './app';
async function bootstrap() {
  const config = parseServerConfig(process.env);
  const app = await createApplication(config, [
    createDatabaseProbe(databaseUrl(config), config.DEPENDENCY_TIMEOUT_MS),
    createCacheProbe(config.REDIS_URL, config.DEPENDENCY_TIMEOUT_MS),
    createSearchProbe(config.OPENSEARCH_URL, config.DEPENDENCY_TIMEOUT_MS),
  ]);
  await app.listen(config.API_PORT, config.API_HOST);
}
bootstrap().catch(() => {
  console.error(
    JSON.stringify({
      level: 'error',
      message: 'Startup failed; verify server configuration',
    }),
  );
  process.exitCode = 1;
});
