import { build } from 'esbuild';
import { resolve } from 'node:path';
await build({
  entryPoints: ['apps/api/src/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/apps/api/main.cjs',
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
