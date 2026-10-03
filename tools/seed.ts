import 'dotenv/config';
import { createGraphClient } from '../libs/database/src';
import {
  seedKnowledgeGraph,
  seedDestinationProfiles,
} from '../libs/database/src/seed';
import { seedDiscovery } from '../libs/database/src/discovery-seed';
import { databaseUrl, parseServerConfig } from '../libs/config/src';
async function seed() {
  const config = parseServerConfig(process.env);
  if (config.NODE_ENV === 'production')
    throw new Error('Development fixture seeding is disabled in production');
  const client = createGraphClient(databaseUrl(config));
  try {
    await seedKnowledgeGraph(client);
    await seedDestinationProfiles(client);
    await seedDiscovery(client);
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
