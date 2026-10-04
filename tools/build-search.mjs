import { build } from 'esbuild';
import { resolve } from 'node:path';
await build({
  entryPoints: ['tools/search-index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/tools/search-index.cjs',
  packages: 'external',
  tsconfig: 'tsconfig.base.json',
  plugins: [
    {
      name: 'workspace',
      setup(build) {
        build.onResolve({ filter: /^@visitspakistan\// }, ({ path }) => ({
          path: resolve('libs', path.split('/')[1], 'src/index.ts'),
        }));
      },
    },
  ],
});
