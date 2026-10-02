import 'dotenv/config';
import { defineConfig } from 'prisma/config';
const url =
  process.env.DATABASE_URL ??
  `postgresql://${encodeURIComponent(process.env.DB_USER ?? 'visitspakistan')}:${encodeURIComponent(process.env.DB_PASS ?? 'visitspakistan')}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5433'}/${process.env.DB_NAME ?? 'visitspakistandb'}`;
export default defineConfig({
  schema: 'libs/database/prisma/schema.prisma',
  migrations: {
    path: 'libs/database/prisma/migrations',
    seed: 'tsx tools/seed.ts',
  },
  datasource: { url },
});
