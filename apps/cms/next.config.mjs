import { resolve } from 'node:path';
export default {
  output: 'standalone',
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  transpilePackages: ['@visitspakistan/ui'],
  poweredByHeader: false,
  trailingSlash: true,
};
