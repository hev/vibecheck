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
    '**/onboarding.test.ts',
  ],
  // Force Jest to exit after tests complete (prevents hanging on interactive components)
  forceExit: true,
  // Detect open handles that might prevent Jest from exiting
  detectOpenHandles: true,
  // Load global mocks for interactive components
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
        'interactive-run.test.ts',
        'onboarding.test.ts',
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
  ],
};
