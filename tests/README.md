# VibeCheck CLI Tests

This directory contains all tests for the VibeCheck CLI tool.

## Directory Structure

```
tests/
├── fixtures/           # Test data and mock responses
├── helpers/            # Test utilities and API mocking
├── integration/        # Integration tests (mocked API)
└── e2e/               # End-to-end tests (live server)
```

## Test Categories

### Unit Tests
- **Location**: `packages/cli/src/**/*.test.ts`
- **Purpose**: Test individual functions and utilities in isolation
- **Requirements**: None (no server, no external dependencies)
- **Run**: `npm run test:unit`

Examples:
- YAML parsing and Zod validation
- Display formatting and text truncation
- Utility functions

### Integration Tests
- **Location**: `tests/integration/**/*.test.ts`
- **Purpose**: Test full command workflows with mocked API
- **Requirements**: None (uses nock for HTTP mocking)
- **Run**: `npm run test:integration`

Examples:
- `vibe check` command with various inputs
- `vibe set` and `vibe get` commands
- Error handling for all HTTP status codes

### E2E Tests
- **Location**: `tests/e2e/**/*.test.ts`
- **Purpose**: Test against real VibeCheck API
- **Requirements**: Live server running, valid API credentials
- **Run**: `npm run test:e2e`

Examples:
- Full check → set → get workflow
- Real model evaluations
- All conditional types with actual responses

## Fixtures

### YAML Fixtures (`fixtures/*.yaml`)

- `valid-eval.yaml` - Simple valid evaluation suite
- `invalid-schema.yaml` - Missing required fields
- `malformed.yaml` - Invalid YAML syntax
- `all-check-types.yaml` - Demonstrates all check types

### Mock Responses (`fixtures/mock-responses.ts`)

Pre-defined API responses for testing:
- Run responses (pending, completed, failed)
- Suite operations (list, get, save)
- Error responses (401, 403, 500)

## Helpers

### API Mocking (`helpers/api-mocks.ts`)

```typescript
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';

const apiMock = setupApiMock();
apiMock.mockRunEval();
apiMock.mockStatusCompleted('run-id');
cleanupApiMocks();
```

### Test Utilities (`helpers/test-utils.ts`)

Useful functions:
- `readFixture(filename)` - Read fixture file
- `parseYamlFixture(filename)` - Parse YAML fixture
- `createTempFile(content, filename)` - Create temporary file
- `cleanupTempFiles()` - Clean up temp files
- `withEnv(envVars, fn)` - Run function with custom env vars
- `suppressConsole(fn)` - Suppress console output
- `mockProcessExit()` - Mock process.exit for testing

## Writing Tests

### Unit Test Example

```typescript
// packages/cli/src/utils/my-util.test.ts
import { describe, it, expect } from '@jest/globals';
import { myFunction } from './my-util';

describe('myFunction', () => {
  it('should handle valid input', () => {
    expect(myFunction('valid')).toBe('expected');
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction('invalid')).toThrow();
  });
});
```

### Integration Test Example

```typescript
// tests/integration/my-command.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { suppressConsole } from '../helpers/test-utils';

describe('My Command', () => {
  let apiMock: ReturnType<typeof setupApiMock>;

  beforeEach(() => {
    apiMock = setupApiMock();
    process.env.VIBECHECK_API_KEY = 'test-key';
  });

  afterEach(() => {
    cleanupApiMocks();
  });

  it('should execute successfully', async () => {
    apiMock.mockRunEval();

    await suppressConsole(async () => {
      // Test implementation
    });
  });
});
```

## Running Tests

```bash
# All tests
npm test

# Specific category
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# CI mode
npm run test:ci
```

## Best Practices

1. **Isolate tests**: Each test should be independent
2. **Clean up**: Use `afterEach` to clean up resources
3. **Mock external calls**: Use `nock` for HTTP, `jest.fn()` for functions
4. **Suppress output**: Use `suppressConsole()` to avoid cluttering test output
5. **Handle process.exit**: Mock `process.exit` to prevent tests from exiting
6. **Use fixtures**: Reuse YAML fixtures instead of creating inline
7. **Test error cases**: Don't just test happy paths

## Debugging

```bash
# Run specific test file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="YAML parsing"

# Verbose output
npm test -- --verbose

# Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Coverage

Coverage reports are generated in `coverage/` directory:

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

Target coverage:
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## Common Issues

### Tests timing out

Increase timeout in test:
```typescript
it('long running test', async () => {
  // test
}, 30000); // 30 second timeout
```

### Nock not intercepting requests

Make sure:
- API URL matches exactly
- Request method matches (GET/POST)
- Clean up nock between tests: `cleanupApiMocks()`

### Process.exit not mocked

Always mock process.exit for CLI commands:
```typescript
const exitMock = jest.spyOn(process, 'exit').mockImplementation();
// ... test code
exitMock.mockRestore();
```

### Environment variables leaking

Use `withEnv()` helper to isolate env vars:
```typescript
await withEnv({ VIBECHECK_API_KEY: 'test' }, async () => {
  // test code with custom env
});
```
