import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
loadDotenv({ quiet: true });
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_USER: z.string().min(1),
  DB_PASS: z.string().min(1),
  DB_NAME: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  REDIS_URL: z
    .url()
    .refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol)),
  OPENSEARCH_URL: z
    .url()
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
  OPENSEARCH_INDEX_URL: z
    .url()
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol))
    .optional(),
  SEARCH_INDEX_PREFIX: z
    .string()
    .regex(/^[a-z0-9_]*$/)
    .max(40)
    .default(''),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.url(),
  CMS_ORIGIN: z.url(),
  SWAGGER_ENABLED: z.enum(['true', 'false']).default('false'),
  DEPENDENCY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(10000)
    .default(3000),
  CMS_MFA_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i)
    .optional(),
  MEDIA_ROOT: z.string().default('.data/media'),
  DATABASE_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url().optional(),
  ),
});
export type ServerConfig = z.infer<typeof schema>;
export function parseServerConfig(
  env: Record<string, string | undefined>,
): ServerConfig {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid server configuration: ${[...new Set(result.error.issues.map((issue) => issue.path[0]))].join(', ')}`,
    );
  if (
    result.data.DATABASE_URL &&
    !['postgresql:', 'postgres:'].includes(
      new URL(result.data.DATABASE_URL).protocol,
    )
  )
    throw new Error('Invalid server configuration: DATABASE_URL');
  return result.data;
}
export function databaseUrl(
  config: Pick<
    ServerConfig,
    'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASS' | 'DB_NAME' | 'DATABASE_URL'
  >,
): string {
  return (
    config.DATABASE_URL ??
    `postgresql://${encodeURIComponent(config.DB_USER)}:${encodeURIComponent(config.DB_PASS)}@${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`
  );
}
