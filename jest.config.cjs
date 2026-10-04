module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/api', '<rootDir>/libs', '<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm|@scure|@noble)',
    'node_modules/\\.pnpm/(?!(?:@scure\\+base|@noble\\+hashes)@)',
  ],
  transform: {
    '^.+\\.js$': '<rootDir>/tools/jest-js-transform.cjs',
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.base.json' }],
  },
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/tools/jest-style.cjs',
    '^@visitspakistan/(.*)$': '<rootDir>/libs/$1/src/index',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'apps/api/src/**/*.ts',
    'libs/**/src/**/*.ts',
    '!**/generated/**',
    '!**/*.spec.ts',
    '!**/main.ts',
  ],
  clearMocks: true,
};
