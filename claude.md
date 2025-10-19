# VibeCheck Project Guide

## Project Overview

VibeCheck is a vibe-themed CLI tool for running language model evaluations. This is the open source CLI tool (MIT licensed) that connects to the VibeCheck API at vibescheck.io.

**Get your API key at [vibescheck.io](https://vibescheck.io)**

## Architecture

This is a monorepo managed with npm workspaces:

- **@vibecheck/cli** (`packages/cli`) - The main CLI interface (open source)
- **@vibecheck/shared** (`packages/shared`) - Shared TypeScript types and Zod schemas

### Languages & Tech Stack

- **Language**: TypeScript 5.3+
- **Runtime**: Node.js 20+
- **CLI Framework**: Commander.js
- **Schema Validation**: Zod
- **CLI Styling**: chalk, ora
- **API**: VibeCheck API at vibescheck.io

## Project Structure

```
vibecheck/
├── packages/                      # CLI packages
│   ├── cli/                       # CLI application (open source)
│   │   ├── src/
│   │   │   ├── index.ts           # Main entry point, commander setup
│   │   │   └── commands/
│   │   │       ├── run.ts         # vibe check command
│   │   │       └── suite.ts       # vibe get/set commands
│   │   └── package.json           # Bins: vibe, vibes
│   │
│   └── shared/                    # Shared types & schemas (open source)
│       ├── src/
│       │   ├── types.ts           # TypeScript types
│       │   └── index.ts           # Exports
│       └── package.json
│
├── examples/                      # Example YAML eval files
├── claude.md                      # This file
├── .cursorrules                   # Symlink to claude.md
├── README.md                      # Main documentation
└── package.json                   # Root workspace config
```

## Key Concepts

### Vibe-Themed Terminology

This project uses playful internet slang terminology:

**Command Structure:**
- `vibe check` (or `vibes check`) - Run evaluations
- `vibe get` - List or retrieve suites
- `vibe set` - Save a suite

**Results:**
- ✨ **good vibes** = 100% pass rate
- 😬 **sketchy vibes** = ≥80% pass rate
- 🚩 **bad vibes** = <80% pass rate

**Individual Conditionals:**
- ✅ **white flag** = PASS (conditional passed)
- 🚩 **red flag** = FAIL (conditional failed)

### Evaluation Suite Format

Evaluation suites are defined in YAML:

```yaml
metadata:
  name: suite-name
  model: anthropic/claude-3.5-sonnet
  system_prompt: You are a helpful assistant  # optional

evals:
  - prompt: Question to ask the model
    checks:
      match: "*expected text*"  # glob pattern matching
      not_match: "*unwanted text*"  # negated patterns
      or:  # OR operator for multiple patterns
        - match: "*option1*"
        - match: "*option2*"
      min_tokens: 10
      max_tokens: 100
      semantic:
        expected: "semantic target"
        threshold: 0.8
      llm_judge:
        criteria: "what to judge"
```

### Check Types

1. **match** - Glob pattern matching (e.g., `*hello*`, `goodbye*`)
2. **not_match** - Negated glob patterns
3. **or** - OR operator for multiple patterns
4. **min_tokens**/**max_tokens** - Token length constraints
5. **semantic** - Compare semantic meaning using embeddings (local)
6. **llm_judge** - Use an LLM to judge the response quality

### Check Logic

**AND Logic (Implicit)**: Multiple checks at the same level must ALL pass
```yaml
checks:
  match: "*hello*"      # AND
  min_tokens: 5         # AND
  max_tokens: 100       # AND
```

**OR Logic (Explicit)**: Use the `or:` field when you want ANY of the patterns to pass
```yaml
checks:
  or:                   # OR (at least one must pass)
    - match: "*yes*"
    - match: "*affirmative*"
    - match: "*correct*"
```

**Combined Logic**: You can mix AND and OR logic
```yaml
checks:
  min_tokens: 10        # AND (must pass)
  or:                   # OR (one of these must pass)
    - match: "*hello*"
    - match: "*hi*"
```

### Workflow

1. User runs `vibe check -f eval.yaml`
2. CLI validates YAML with Zod schemas
3. CLI sends eval suite to VibeCheck API
4. API runs each evaluation and checks checks
5. CLI polls for results and displays streaming output
6. Exit code 1 if <80% pass rate

## Development Guidelines

### Build Order

Build packages in this order:
1. `@vibecheck/shared`
2. `@vibecheck/cli`

Or use: `npm run build` (runs in correct order)

### Running Locally

```bash
# Build and run CLI
npm run build
npm run start -- check -f examples/evals.yaml

# Or watch mode
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required: Get your API key at https://vibescheck.io
VIBECHECK_API_KEY=your-api-key-here

# Optional: Override the API URL (defaults to http://localhost:3000)
VIBECHECK_URL=http://localhost:3000
```

### Authentication

The CLI uses **bearer token authentication** for all API requests:
- All requests include: `Authorization: Bearer <VIBECHECK_API_KEY>`
- The API key is validated on every request
- Missing or invalid API keys result in 401 errors

Error handling:
- **401 Unauthorized**: Invalid or missing API key
- **500 Server Error**: The VibeCheck API encountered an error

### Adding New Conditional Types

1. Add type to shared types (`packages/shared/src/types.ts`)
2. Update Zod schema in shared package
3. Rebuild shared package: `npm run build -w @vibecheck/shared`

Note: Server-side conditional implementation is handled by the VibeCheck API.

## Common Commands

```bash
# Install all dependencies
npm install

# Build CLI
npm run build

# Build specific package
npm run build -w @vibecheck/shared
npm run build -w @vibecheck/cli

# Run CLI in dev mode
npm run dev

# Run CLI
npm run start -- check -f examples/evals.yaml

# Link CLI globally
cd packages/cli && npm link
vibe check -f examples/evals.yaml
```

## CLI Output Format

The CLI provides rich, colored output:
- **Blue** - Prompts
- **Gray** - Responses
- **Green** - Passed items, good vibes
- **Yellow** - Sketchy vibes (≥80%)
- **Red** - Failed items, bad vibes

Summary uses GitHub-style diff notation:
```
eval-name-1  ----|+++++  ✅ in 2.3s
eval-name-2  ---|++++++  ✅ in 1.8s
```

Where `-` = failed conditional, `+` = passed conditional

## Important Notes

- The CLI supports both `vibe` and `vibes` commands (aliases)
- Documentation consistently uses `vibe` for clarity
- Exit code 1 when vibe rating < 80%
- Results are streamed in real-time via polling
- The CLI is **open source (MIT)** - encourage contributions!
- Get your API key at **vibescheck.io**

## Testing

### Test Structure

The project uses **Jest** with TypeScript for testing. Tests are organized into three layers:

#### 1. Unit Tests (`packages/cli/src/**/*.test.ts`)

**Isolated, no server required.** Test individual functions and utilities:

- **YAML Parsing & Validation** (`utils/yaml-parser.test.ts`)
  - Valid/invalid YAML schemas
  - Zod validation errors
  - All conditional types (string_contains, semantic_similarity, llm_judge, token_length)
  - Edge cases and optional fields

- **Display Utilities** (`utils/display.test.ts`)
  - Summary formatting
  - Pass/fail rate calculations
  - Vibe rating logic (good/sketchy/bad vibes)
  - Visual bar charts
  - Text truncation

#### 2. Integration Tests (`tests/integration/**/*.test.ts`)

**Mocked API, no live server required.** Test full command workflows:

- **Command Integration** (`commands.test.ts`)
  - `vibe check` with valid/invalid YAML
  - `vibe set` for saving suites
  - `vibe get suites` for listing
  - `vibe get suite <name>` for retrieval
  - Error handling (401, 403, 500)
  - Missing API key scenarios

Uses **nock** for HTTP mocking to simulate API responses.

#### 3. E2E Tests (`tests/e2e/**/*.test.ts`)

**Live server required.** Test against real VibeCheck API:

- Full workflow validation
- Real API integration
- Actual model evaluations

**Note:** E2E tests are currently disabled pending setup of test helpers. See `tests/e2e/README.md` for setup instructions. The e2e test file exists but requires additional helper utilities to run.

### Running Tests

```bash
# Run all tests
npm test

# Run only unit tests (fast, isolated)
npm run test:unit

# Run only integration tests (mocked API)
npm run test:integration

# Run only E2E tests (requires live server - currently disabled)
# npm run test:e2e

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# CI mode (for automated pipelines)
npm run test:ci
```

### Test Fixtures

Test fixtures are located in `tests/fixtures/`:

- `valid-eval.yaml` - Valid evaluation suite
- `invalid-schema.yaml` - Missing required fields
- `malformed.yaml` - Invalid YAML syntax
- `all-check-types.yaml` - All conditional types
- `mock-responses.ts` - Mock API responses

### Test Helpers

Located in `tests/helpers/`:

- `api-mocks.ts` - HTTP mocking utilities using nock
- `test-utils.ts` - Common test utilities (env helpers, file operations, etc.)

### Writing New Tests

#### Unit Tests

Place unit tests next to the source files with `.test.ts` extension:

```typescript
// packages/cli/src/utils/my-util.test.ts
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
// tests/integration/my-feature.test.ts
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

**IMPORTANT:** Always run tests before committing:

```bash
# Quick check (unit + integration)
npm run test:unit && npm run test:integration

# Full check including coverage
npm run test:coverage
```

Ensure:
- All tests pass
- No console errors or warnings
- Coverage remains above 80% for critical paths

### CI/CD Integration

For continuous integration:

```bash
# In your CI pipeline
npm install
npm run build
npm run test:ci
```

The `test:ci` command:
- Runs in non-interactive mode
- Generates coverage reports
- Limits workers for CI environments
- Fails on any test failures

### Coverage Goals

- **Unit tests**: 80%+ coverage of utilities and parsers
- **Integration tests**: All commands with mocked API
- **E2E tests**: Critical user workflows

### Debugging Tests

```bash
# Run specific test file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="YAML parsing"

# Verbose output
npm test -- --verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Manual Testing

Run evaluations against your prompts:
```bash
vibe check -f examples/evals.yaml
```

The suite passes if ≥80% of evaluations pass.

## Troubleshooting

**"API Error"** - Ensure your `VIBECHECK_API_KEY` is set correctly
**"Invalid YAML"** - Check YAML against schema in `@vibecheck/shared`
**Build errors** - Rebuild `@vibecheck/shared` first, then other packages
