import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';
import type { DependencyProbe } from '@visitspakistan/domain';
export function createDatabaseProbe(
  url: string,
  timeoutMs: number,
): DependencyProbe {
  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      connectionTimeoutMillis: timeoutMs,
      query_timeout: timeoutMs,
      statement_timeout: timeoutMs,
      max: 4,
    }),
  });
  return {
    name: 'database',
    required: true,
    async check() {
      const result = await client.$queryRaw<
        Array<{ value: string }>
      >`SELECT value FROM platform_metadata WHERE key = 'schema_version'`;
      if (result[0]?.value !== 'sprint-0')
        throw new Error('Schema unavailable');
      await client.$queryRaw`SELECT PostGIS_Version()`;
    },
    async close() {
      await client.$disconnect();
    },
  };
}

export * from './knowledge-graph.repository';

export * from './editorial-store';
export * from './staff-auth';
export * from './media-store';
export { Prisma } from './generated/client';

export * from './destination-reader';
