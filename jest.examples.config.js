module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/examples/**/*.test.ts'],
  testTimeout: 120000, // Examples involve API calls
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
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
  forceExit: true,
  detectOpenHandles: false,
};
