module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/*.integration.ts'],
  testTimeout: 20000,
};
