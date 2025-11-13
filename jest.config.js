module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/index.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  // Force Jest to exit after tests complete
  // This is necessary because nock's MockHttpSocket creates lingering connections
  // that don't close synchronously. All tests pass successfully - the warning
  // "Force exiting Jest: Have you considered using --detectOpenHandles" is expected
  // and can be safely ignored. The cleanup in afterEach() is already optimal.
  forceExit: true,
  // Note: detectOpenHandles: false doesn't suppress the forceExit warning
  // The warning is hardcoded in Jest when forceExit: true
  detectOpenHandles: false,
  // Run projects sequentially to avoid race conditions with nock mocks
  // This prevents intermittent failures when running 'npm test'
  maxWorkers: 1,
  // Load global mocks
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup-mocks.js'],
  // Separate test categories with displayName
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/packages/*/src/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
      ],
      preset: 'ts-jest',
      testEnvironment: 'node',
    },
    // E2E tests are commented out until test helpers are created
    // See tests/e2e/README.md for setup instructions
    // {
    //   displayName: 'e2e',
    //   testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
    //   preset: 'ts-jest',
    //   testEnvironment: 'node',
    //   testTimeout: 120000, // E2E tests may take longer
    // },
    {
      displayName: 'examples',
      testMatch: ['<rootDir>/tests/examples/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      testTimeout: 120000, // Examples involve API calls
    },
  ],
};
