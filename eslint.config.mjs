import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import nx from '@nx/eslint-plugin';
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      'dist/**',
      '.nx/**',
      'libs/database/src/generated/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['apps/**/*.{ts,tsx}', 'libs/**/*.{ts,tsx}'],
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: [
            {
              sourceTag: 'type:backend',
              onlyDependOnLibsWithTags: [
                'type:domain',
                'type:config',
                'type:infrastructure',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:testing',
              onlyDependOnLibsWithTags: [
                'type:domain',
                'type:config',
                'type:infrastructure',
                'type:testing',
              ],
            },
            {
              sourceTag: 'type:config',
              onlyDependOnLibsWithTags: ['type:config'],
            },
            {
              sourceTag: 'type:frontend',
              onlyDependOnLibsWithTags: ['type:ui', 'type:domain'],
            },
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:domain'],
              bannedExternalImports: [
                '@nestjs/*',
                '@prisma/*',
                'redis',
                'next',
                'react',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:domain'],
            },
            {
              sourceTag: 'type:infrastructure',
              onlyDependOnLibsWithTags: [
                'type:domain',
                'type:config',
                'type:infrastructure',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
