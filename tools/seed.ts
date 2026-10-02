import 'dotenv/config';
import { createGraphClient } from '../libs/database/src';
import { seedKnowledgeGraph } from '../libs/database/src/seed';
import { databaseUrl, parseServerConfig } from '../libs/config/src';
async function seed() {
  const config = parseServerConfig(process.env);
  if (config.NODE_ENV === 'production')
    throw new Error('Development fixture seeding is disabled in production');
  const client = createGraphClient(databaseUrl(config));
  try {
    await seedKnowledgeGraph(client);
    await client.destinationProfile.createMany({
      data: [4, 5].map((n) => ({
        id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
        sourceId: '00000000-0000-4000-8000-000000000900',
        interests: [],
        seasons: [],
      })),
      skipDuplicates: true,
    });
    console.log('Canonical graph and destination development drafts seeded');
  } finally {
    await client.$disconnect();
  }
}
seed().catch(() => {
  console.error(
    'Seed failed; verify database migrations and fixture identities',
  );
  process.exitCode = 1;
});
