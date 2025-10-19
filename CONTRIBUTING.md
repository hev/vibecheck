# Contributing to VibeCheck CLI

Thank you for your interest in contributing to VibeCheck! This guide will help you get started with development and understand our contribution process.

## Development Setup

### Prerequisites

- Node.js 20+
- npm (comes with Node.js)
- Git

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/vibecheck.git
   cd vibecheck
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Link the CLI for global usage (optional)**
   ```bash
   npm run build:link
   ```

### Development Workflow

#### Watch Mode
For active development, use watch mode to automatically rebuild on changes:

```bash
npm run dev
```

#### Running the CLI
```bash
# Run with a specific file
npm run start -- check -f examples/hello-world.yaml

# Run in interactive mode
npm run start -- check -f examples/hello-world.yaml --interactive
```

#### Testing
Always run tests before submitting a PR:

```bash
# Run all tests
npm test

# Run only unit tests (fast, isolated)
npm run test:unit

# Run only integration tests (mocked API)
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Project Architecture

This is a monorepo managed with npm workspaces:

```
vibecheck/
├── packages/
│   ├── cli/                    # Main CLI application
│   │   ├── src/
│   │   │   ├── index.ts        # Main entry point, commander setup
│   │   │   ├── commands/       # Command implementations
│   │   │   ├── ui/             # Interactive UI components
│   │   │   └── utils/          # Utilities (display, parsing, etc.)
│   │   └── package.json        # CLI package config
│   └── shared/                 # Shared types & schemas
│       ├── src/
│       │   ├── types.ts        # TypeScript types
│       │   └── index.ts        # Exports
│       └── package.json
├── examples/                   # Example YAML eval files
├── tests/                      # Test suites
└── package.json               # Root workspace config
```

### Key Components

- **CLI Commands** (`packages/cli/src/commands/`): Implementation of all CLI commands
- **Interactive UI** (`packages/cli/src/ui/`): Blessed-based terminal UI
- **Utilities** (`packages/cli/src/utils/`): Display formatting, YAML parsing, etc.
- **Shared Types** (`packages/shared/`): TypeScript types and Zod schemas

## Adding New Check Types

To add a new check type:

1. **Add type to shared types** (`packages/shared/src/types.ts`)
   ```typescript
   export const ChecksSchema = z.object({
     // ... existing checks
     your_new_check: z.object({
       // your check configuration
     }).optional()
   });
   ```

2. **Update Zod schema** in the same file

3. **Rebuild shared package**
   ```bash
   npm run build -w @vibecheck/shared
   ```

4. **Update CLI implementation** (server-side handled by VibeCheck API)

5. **Add tests** for the new check type

6. **Update documentation** in README.md

## Testing Guidelines

### Test Structure

- **Unit Tests** (`packages/cli/src/**/*.test.ts`): Test individual functions
- **Integration Tests** (`tests/integration/`): Test full command workflows with mocked API
- **E2E Tests** (`tests/e2e/`): Test against real VibeCheck API (currently disabled)

### Writing Tests

#### Unit Tests
Place unit tests next to source files with `.test.ts` extension:

```typescript
import { describe, it, expect } from '@jest/globals';
import { myFunction } from './my-util';

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction()).toBe(expectedValue);
  });
});
```

#### Integration Tests
Create integration tests in `tests/integration/`:

```typescript
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('My Feature Integration', () => {
  beforeEach(() => {
    const apiMock = setupApiMock();
    apiMock.mockRunEval();
  });

  afterEach(() => {
    cleanupApiMocks();
  });

  it('should work with mocked API', async () => {
    // Test implementation
  });
});
```

### Pre-commit Testing

**IMPORTANT**: Always run tests before committing:

```bash
# Quick check (unit + integration)
npm run test:unit && npm run test:integration

# Full check including coverage
npm run test:coverage
```

## Submitting Changes

### Pull Request Process

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the coding standards
3. **Run tests** to ensure everything passes
4. **Update documentation** if needed
5. **Submit a pull request** with a clear description

### PR Requirements

- All tests must pass
- Code coverage should not decrease
- Include tests for new functionality
- Update documentation for user-facing changes
- Follow existing code style and patterns

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Description**: Clear description of the issue
- **Steps to reproduce**: Exact steps to reproduce the problem
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: OS, Node.js version, CLI version
- **Logs**: Any relevant error messages or logs

### API Problems

If you encounter API-related issues (401, 403, 500 errors):

1. **Check your API key**: Ensure `VIBECHECK_API_KEY` is set correctly
2. **Verify API status**: Check if the VibeCheck API is operational
3. **File an issue**: Include error details and API response

### Feature Requests

For feature requests:

- **Describe the feature**: What functionality would you like to see?
- **Use case**: How would this help your workflow?
- **Proposed implementation**: Any ideas on how it could work?

## Code Style

- Use TypeScript with strict mode
- Follow existing naming conventions
- Add JSDoc comments for public functions
- Use meaningful variable and function names
- Keep functions focused and small
- Add error handling for edge cases

## Release Process

Releases are handled by maintainers using the `scripts/publish.sh` script:

1. Run tests and build
2. Version bump (patch/minor/major)
3. Publish to npm with `--access public`
4. Create and push git tags

## Getting Help

- **Documentation**: Check the README.md for usage examples
- **Issues**: Search existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions and ideas

## License

By contributing to VibeCheck, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to VibeCheck! 🎉
