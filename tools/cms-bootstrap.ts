import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import {
  createGraphClient,
  EditorialStore,
  MediaStore,
} from '../libs/database/src';
import {
  encryptMfa,
  hashPassword,
  generateSecret,
  generateURI,
} from '../libs/auth/src';
import { brandTokens, blockTypes, editorialTypes } from '../libs/domain/src';
import { databaseUrl, parseServerConfig } from '../libs/config/src';
import {
  seedKnowledgeGraph,
  seedId,
  seedSourceId,
} from '../libs/database/src/seed';
import type { CmsActor, CmsRole } from '../libs/domain/src';
async function bootstrap() {
  const config = parseServerConfig(process.env);
  if (config.NODE_ENV === 'production')
    throw new Error('Local fixture bootstrap is disabled in production');
  if (!config.CMS_MFA_KEY) throw new Error('Configure CMS_MFA_KEY first');
  const db = createGraphClient(databaseUrl(config));
  try {
    await seedKnowledgeGraph(db);
    const accounts: Array<{
      email: string;
      displayName: string;
      password: string;
      totpSecret: string;
      otpauth: string;
      roles: CmsRole[];
    }> = [];
    const actors: CmsActor[] = [];
    for (const [name, roles] of [
      ['Author', ['CONTRIBUTOR']],
      ['Editor', ['EDITOR']],
      ['Administrator', ['ADMINISTRATOR', 'EDITOR', 'CONTRIBUTOR']],
    ] as Array<[string, CmsRole[]]>) {
      const email = `${name.toLowerCase()}@visitspakistan.test`;
      let account = await db.staffAccount.findUnique({ where: { email } });
      if (!account) {
        const password = randomBytes(18).toString('base64url');
        const totpSecret = generateSecret();
        account = await db.staffAccount.create({
          data: {
            email,
            displayName: `Development ${name}`,
            passwordHash: await hashPassword(password),
            mfaSecret: encryptMfa(totpSecret, config.CMS_MFA_KEY),
            roles,
          },
        });
        accounts.push({
          email,
          displayName: account.displayName,
          password,
          totpSecret,
          otpauth: generateURI({
            issuer: 'VisitsPakistan CMS',
            label: email,
            secret: totpSecret,
          }),
          roles,
        });
      }
      actors.push({
        id: account.id,
        roles: account.roles,
        displayName: account.displayName,
      });
    }
    if (accounts.length) {
      let previous: typeof accounts = [];
      try {
        previous =
          JSON.parse(await readFile('.cms-bootstrap.json', 'utf8')).accounts ??
          [];
      } catch {
        /* first bootstrap */
      }
      await writeFile(
        '.cms-bootstrap.json',
        JSON.stringify(
          {
            warning:
              'Local development credentials. Import TOTP URI in an authenticator. Do not commit.',
            accounts: [...previous, ...accounts],
          },
          null,
          2,
        ) + '\n',
        { mode: 0o600 },
      );
    }
    const admin = actors[2]!;
    const store = new EditorialStore(db);
    let hero = await db.mediaAsset.findFirst({
      where: {
        credit: 'VisitsPakistan original illustration · development sample',
      },
    });
    if (!hero) {
      const sharp = (await import('sharp')).default;
      const image = await sharp(
        await readFile('apps/cms/public/hunza-illustration.svg'),
      )
        .png()
        .toBuffer();
      hero = await new MediaStore(db, config.MEDIA_ROOT).upload(
        admin,
        image,
        'Illustrated mountain landscape for the Hunza editorial draft',
        'VisitsPakistan original illustration · development sample',
      );
    }
    const theme = await db.siteTheme.upsert({
      where: { slug: 'majestic-indus' },
      update: {},
      create: {
        name: 'Majestic Indus',
        slug: 'majestic-indus',
        tokens: brandTokens,
      },
    });
    const templates = [];
    for (const [slug, name, layout] of [
      ['editorial', 'Editorial journal', 'EDITORIAL'],
      ['magazine', 'Discovery magazine', 'MAGAZINE'],
      ['compact', 'Field guide', 'COMPACT'],
    ] as const) {
      templates.push(
        await db.siteTemplate.upsert({
          where: { slug },
          update: {},
          create: { slug, name, layout, allowedBlocks: [...blockTypes] },
        }),
      );
    }
    await db.sitePresentation.upsert({
      where: { id: 'website' },
      update: {},
      create: { id: 'website', themeId: theme.id },
    });
    for (const type of editorialTypes)
      await db.templateAssignment.upsert({
        where: { type },
        update: {},
        create: { type, templateId: templates[0]!.id },
      });
    if (
      !(await db.entityRegistry.findUnique({
        where: {
          kind_locale_slug: {
            kind: 'CONTENT_ITEM',
            locale: 'en',
            slug: 'hunza-editorial',
          },
        },
      }))
    )
      await store.create(actors[0]!, {
        type: 'DESTINATION_EDITORIAL',
        slug: 'hunza-editorial',
        locale: 'en',
        primaryEntityId: seedId(4),
        body: {
          title: 'Hunza, a different pace',
          summary:
            'An editorial invitation to pause, look closer and discover Hunza through its landscapes and local stories.',
          seoTitle: 'Hunza travel inspiration | VisitsPakistan',
          metaDescription:
            'Explore our Hunza editorial draft: landscape inspiration, local stories and a reading list grounded in canonical destination references.',
          heroMediaId: hero.id,
          lastVerified: null,
          sourceIds: [seedSourceId],
          canonicalIds: [seedId(4), seedId(20)],
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'Let the landscape set the pace',
            },
            {
              type: 'paragraph',
              text: 'A destination is more than a checklist. This Hunza editorial draft makes room for slow observation, thoughtful encounters and the stories that connect a traveler to a place.',
            },
            {
              type: 'callout',
              tone: 'note',
              text: 'Development draft: independently review sources and canonical references before publication. This illustration is not a destination photograph.',
            },
            {
              type: 'entity_reference',
              entityId: seedId(20),
              label: 'Explore the Attabad Lake canonical reference',
            },
            { type: 'heading', level: 2, text: 'Build your reading list' },
            {
              type: 'list',
              items: [
                'Gather locally confirmed access and seasonal information.',
                'Review the destination and attraction sources.',
                'Add credited, rights-cleared destination photography.',
              ],
            },
          ],
        },
      });
    for (const [type, slug, title, entityId] of [
      [
        'ATTRACTION_EDITORIAL',
        'attabad-lake-editorial',
        'Attabad Lake editorial draft',
        seedId(20),
      ],
      [
        'EXPERIENCE_EDITORIAL',
        'lake-boating-editorial',
        'Boating experience editorial draft',
        seedId(21),
      ],
    ] as const) {
      if (
        await db.entityRegistry.findUnique({
          where: {
            kind_locale_slug: { kind: 'CONTENT_ITEM', locale: 'en', slug },
          },
        })
      )
        continue;
      await store.create(actors[0]!, {
        type,
        slug,
        locale: 'en',
        primaryEntityId: entityId,
        body: {
          title,
          summary:
            'Development editorial sample linked to canonical knowledge. Independent evidence is required before publication.',
          seoTitle: `${title} | VisitsPakistan`,
          metaDescription:
            'A development sample illustrating canonical entity references, credited sources and independent editorial review. This draft is not approved visitor guidance.',
          heroMediaId: hero.id,
          lastVerified: null,
          sourceIds: [seedSourceId],
          canonicalIds: [entityId],
          blocks: [
            {
              type: 'paragraph',
              text: 'Use sourced narrative here. Opening, admission, duration and geographic facts remain owned by the canonical entity.',
            },
            {
              type: 'entity_reference',
              entityId,
              label: 'Canonical travel knowledge reference',
            },
            {
              type: 'callout',
              tone: 'note',
              text: 'Unverified development draft. The hero is an illustration, not a photograph of this attraction or activity.',
            },
          ],
        },
      });
    }
    console.log(
      'CMS draft, brand theme and templates ready. New local staff credentials, if created, are in ignored .cms-bootstrap.json',
    );
  } finally {
    await db.$disconnect();
  }
}
bootstrap().catch(() => {
  console.error(
    'CMS bootstrap failed; verify migrations, MFA key and local storage',
  );
  process.exitCode = 1;
});
