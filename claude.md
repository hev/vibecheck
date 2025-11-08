# vibecheck Project Guide

## Project Overview

vibecheck is a vibe-themed CLI tool for running language model evaluations. This is the open source CLI tool (MIT licensed) that connects to the vibecheck API at vibescheck.io.

**Get your API key at [vibescheck.io](https://vibescheck.io)**

## Architecture

This is a monorepo managed with npm workspaces:

- **@vibe/cli** (`packages/cli`) - The main CLI interface (open source)
- **@vibecheck/shared** (`packages/shared`) - Shared TypeScript types and Zod schemas

### Languages & Tech Stack

- **Language**: TypeScript 5.3+
- **Runtime**: Node.js 20+
- **CLI Framework**: Commander.js
- **Schema Validation**: Zod
- **CLI Styling**: chalk, ora
- **API**: vibecheck API at vibescheck.io

## Project Structure

```
vibecheck/
├── packages/                      # CLI packages
│   ├── cli/                       # CLI application (open source)
│   │   ├── src/
│   │   │   ├── index.ts           # Main entry point, commander setup
│   │   │   ├── commands/          # All CLI commands
│   │   │   │   ├── run.ts         # vibe check command
│   │   │   │   ├── suite.ts       # vibe set/get commands
│   │   │   │   ├── runs.ts        # vibe get runs command
│   │   │   │   ├── models.ts      # vibe get models command
│   │   │   │   ├── org.ts         # vibe get org command
│   │   │   │   └── redeem.ts      # vibe redeem command
│   │   │   └── utils/             # Utilities
│   │   │       ├── display.ts     # Display formatting
│   │   │       ├── config.ts      # Configuration management
│   │   │       └── auth-error.ts  # Authentication error handling
│   │   └── package.json           # Bins: vibe, vibes
│   │
│   └── shared/                    # Shared types & schemas (open source)
│       ├── src/
│       │   ├── types.ts           # TypeScript types
│       │   └── index.ts           # Exports
│       └── package.json
│
├── examples/                      # Example YAML eval files
│   ├── hello-world.yaml          # Basic checks example
│   ├── multilingual-pbj.yaml     # Multilingual testing
│   └── politics.yaml             # Political evaluation
├── scripts/                       # Publishing and build scripts
│   └── publish.sh                # npm publishing script
├── tests/                         # Test suites
│   ├── integration/              # Integration tests
│   ├── e2e/                      # End-to-end tests
│   ├── fixtures/                 # Test fixtures
│   └── helpers/                  # Test utilities
├── claude.md                     # This file
├── .cursorrules                  # Symlink to claude.md
├── README.md                     # Main documentation
├── CONTRIBUTING.md               # Development guidelines
└── package.json                  # Root workspace config
```

## Key Concepts

### Vibe-Themed Terminology

This project uses playful internet slang terminology:

**Command Structure:**
- `vibe check` (or `vibes check`) - Run evaluations
- `vibe set suite` - Save a suite
- `vibe get` - List or retrieve resources (suites, runs, models, org, vars)
- `vibe delete` - Delete resources (vars, secrets)
- `vibe redeem` - Redeem invite codes

**Results:**
Success rates are displayed with color coding:
- **Green** (>80% pass rate) - High success rate
- **Yellow** (50-80% pass rate) - Moderate success rate
- **Red** (<50% pass rate) - Low success rate

**Individual Conditionals:**
- ✅ **PASS** - Check passed
- ❌ **FAIL** - Check failed

### Evaluation Suite Format

Evaluation suites are defined in YAML:

```yaml
metadata:
  name: suite-name
  model: anthropic/claude-3.5-sonnet
  system_prompt: You are a helpful assistant  # optional
  mcp_server:  # optional
    url: "https://your-mcp-server.com"
    name: "server-name"
    authorization_token: "your-token"

evals:
  - prompt: Question to ask the model
    checks:
      - match: "*expected text*"  # glob pattern matching
      - not_match: "*unwanted text*"  # negated patterns
      - or:  # OR operator for multiple patterns
          - match: "*option1*"
          - match: "*option2*"
      - min_tokens: 10
      - max_tokens: 100
      - semantic:
          expected: "semantic target"
          threshold: 0.8
      - llm_judge:
          criteria: "what to judge"
```

### Check Types

1. **match** - Pattern matching supporting both glob and regex syntax
   - **Glob patterns** (recommended): `*hello*`, `goodbye*`, `*world`, `exact`
   - **Regex patterns** (advanced): `.*hello.*`, `^goodbye`, `world$`
2. **not_match** - Negated patterns (must NOT match)
3. **or** - OR operator for multiple patterns
4. **min_tokens**/**max_tokens** - Token length constraints
5. **semantic** - Compare semantic meaning using embeddings (local)
6. **llm_judge** - Use an LLM to judge the response quality

### Check Logic

**AND Logic (Array Format)**: Multiple checks in an array must ALL pass
```yaml
checks:
  - match: "*hello*"      # AND
  - min_tokens: 5         # AND
  - max_tokens: 100       # AND
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
  - min_tokens: 10        # AND (must pass)
  - or:                   # OR (one of these must pass)
      - match: "*hello*"
      - match: "*hi*"
```

### CLI Command Pattern

All CLI commands follow the `vibe <verb> <noun>` pattern for consistency and clarity.

**Standard Pattern:** `vibe <verb> <noun> [arguments] [options]`

**Verbs:**
- `check` - Run evaluations
- `get` - Retrieve/list resources
- `set` - Create/update resources
- `delete` - Remove resources
- `stop` - Stop/cancel operations
- `redeem` - Redeem invite codes

**Nouns:**
- `suite` - Evaluation suites
- `runs` / `run` - Evaluation runs
- `models` - Available models
- `org` / `credits` - Organization info
- `var` / `vars` - Runtime variables
- `secret` / `secrets` - Runtime secrets

**Examples:**
```bash
vibe check <suite-name>          # Verb: check, Noun: suite-name
vibe get suite <name>            # Verb: get, Noun: suite
vibe get vars                    # Verb: get, Noun: vars (plural for list)
vibe set var <name> <value>      # Verb: set, Noun: var
vibe delete secret <name>        # Verb: delete, Noun: secret
vibe stop queued                 # Verb: stop, Noun: queued (special case)
```

This pattern makes commands predictable and easy to discover through tab completion and help text.

## CLI Commands Reference

### `vibe check` - Run Evaluations

Run evaluations from a YAML file.

```bash
vibe check -f examples/hello-world.yaml
vibe check -f examples/hello-world.yaml --async        # Non-blocking
vibe check  # Auto-detect evals.yaml, eval.yaml, evals.yml, eval.yml
```

**Options:**
- `-f, --file <path>` - Path to YAML file (required if no auto-detected file)
- `-a, --async` - Exit immediately after starting (non-blocking)
- `-d, --debug` - Enable debug logging (hidden option)

### `vibe set` - Create/Update Resources

Create or update resources (suites, variables, secrets).

#### Suites
```bash
vibe set suite -f my-eval.yaml
vibe set suite -f my-eval.yaml --debug
```

**Options:**
- `-f, --file <path>` - Path to YAML file (required)
- `-d, --debug` - Enable debug logging (hidden option)

#### Variables
```bash
vibe set var <name> <value>
vibe set var <name> <value> --debug
```

Sets or updates a runtime variable. The API handles upsert logic.

**Arguments:**
- `<name>` - Variable name (required)
- `<value>` - Variable value (required)

#### Secrets
```bash
vibe set secret <name> <value>
vibe set secret <name> <value> --debug
```

Sets or updates a runtime secret. The API handles upsert logic.

**Arguments:**
- `<name>` - Secret name (required)
- `<value>` - Secret value (required)

### `vibe get` - List/Retrieve Resources

Get various resources with filtering options.

#### Suites
```bash
vibe get suites                    # List all suites
vibe get suite <name>             # Get specific suite
vibe get evals                    # Alias for suites
vibe get eval <name>              # Alias for suite
```

#### Runs
```bash
vibe get runs                     # List all runs
vibe get runs <id>                # Get specific run
vibe get runs --suite <name>      # Filter by suite
vibe get runs --status completed  # Filter by status
vibe get runs --success-gt 80     # Filter by success rate
vibe get runs --time-lt 60        # Filter by duration
vibe get runs --limit 10          # Limit results
vibe get runs --offset 20         # Pagination offset
```

#### Models
```bash
vibe get models                   # List all models
vibe get models --mcp             # Only MCP-supported models
vibe get models --price 1,2       # Filter by price quartiles
vibe get models --provider anthropic,openai  # Filter by providers
```

#### Organization
```bash
vibe get org                      # Organization info
vibe get credits                  # Credits/usage info
```

#### Variables
```bash
vibe get vars                     # List all variables (name=value format)
vibe get var <name>               # Get specific variable value
```

**Arguments:**
- `<name>` - Variable name (required for `vibe get var`)

#### Secrets
```bash
vibe get secrets                  # List all secrets (names only, no values)
vibe get secret <name>            # Error: Secret values cannot be read
```

Secret values are write-only for security reasons. You can list secret names with `vibe get secrets`, but individual secret values cannot be retrieved. Use `vibe set secret` to create/update and `vibe delete secret` to remove.

**Common Options:**
- `-l, --limit <number>` - Limit results (default: 50)
- `-o, --offset <number>` - Offset for pagination (default: 0)
- `-d, --debug` - Enable debug logging (hidden option)

### `vibe delete` - Remove Resources

Delete variables or secrets.

#### Variables
```bash
vibe delete var <name>
vibe delete var <name> --debug
```

**Arguments:**
- `<name>` - Variable name (required)

#### Secrets
```bash
vibe delete secret <name>
vibe delete secret <name> --debug
```

**Arguments:**
- `<name>` - Secret name (required)

### `vibe redeem` - Redeem Invite Codes

Redeem an invite code to create an organization and receive an API key.

```bash
vibe redeem <code>
vibe redeem <code> --debug
```

**Arguments:**
- `<code>` - The invite code to redeem (required)

**Options:**
- `-d, --debug` - Enable debug logging (hidden option)

## Development Guidelines

### Project Rules

**Always follow this approach:**
1. **Research** (optional) - Understand the problem/feature
2. **Plan** - Create a clear plan with todos
3. **Build** - Implement with tests

**Testing Requirements:**
- Always add tests when creating new features
- Always run tests before completing a task
- Maintain 80%+ test coverage for critical paths

### Build Order

Build packages in this order:
1. `@vibecheck/shared`
2. `@vibe/cli`

Or use: `npm run build` (runs in correct order)

### Running Locally

```bash
# Install dependencies
npm install

# Build and run CLI
npm run build
npm run start -- check -f examples/hello-world.yaml

# Or watch mode for development
npm run dev

# Link CLI globally
npm run build:link
vibe check -f examples/hello-world.yaml
```

### Publishing

Use the publishing script for safe releases:

```bash
# Default: Publish to npm, ask about Homebrew
./scripts/publish.sh

# Publish only to npm
./scripts/publish.sh --npm-only

# Publish only to Homebrew
./scripts/publish.sh --homebrew-only

# Publish to both npm and Homebrew automatically
./scripts/publish.sh --auto-homebrew

# Show help
./scripts/publish.sh --help
```

The script handles:
- Git status validation
- Test execution (unit + integration)
- Build verification
- Version bumping (patch/minor/major) - npm only
- npm publish with `--access public`
- Homebrew tap publishing

#### Homebrew Publishing

The project includes support for Homebrew distribution:

```bash
# Publish to Homebrew tap only
./scripts/publish-homebrew.sh

# Or use the main script which offers Homebrew publishing after npm
./scripts/publish.sh
```

**Prerequisites for Homebrew:**
1. Create a GitHub repository named `vibe` (not `homebrew-vibe`)
2. Update `TAP_REPO` in `scripts/publish-homebrew.sh` with your GitHub username
3. Ensure the npm package is published first (Homebrew formula sources from npm)

**Installation will be:**
```bash
brew install yourusername/vibe
```

### Environment Variables

Create a configuration file at `~/.vibecheck/.env`:

```bash
# Required: Get your API key at https://vibescheck.io
VIBECHECK_API_KEY=your-api-key-here

# Optional: Override the API URL (defaults to production Cloud Run)
VIBECHECK_URL=https://vibecheck-api-prod-681369865361.us-central1.run.app
```

Quick setup:
```bash
mkdir -p ~/.vibecheck
echo "VIBECHECK_API_KEY=your-api-key-here" > ~/.vibecheck/.env
```

### Authentication

The CLI uses **bearer token authentication** for all API requests:
- All requests include: `Authorization: Bearer <VIBECHECK_API_KEY>`
- The API key is validated on every request
- Missing or invalid API keys result in 401 errors

Error handling:
- **401 Unauthorized**: Invalid or missing API key
- **500 Server Error**: The vibecheck API encountered an error

### Adding New Check Types

1. Add type to shared types (`packages/shared/src/types.ts`)
2. Update Zod schema in shared package
3. Rebuild shared package: `npm run build -w @vibecheck/shared`

Note: Server-side conditional implementation is handled by the vibecheck API.

## Testing

### Test Structure

The project uses **Jest** with TypeScript for testing. Tests are organized into three layers:

#### 1. Unit Tests (`packages/cli/src/**/*.test.ts`)

**Isolated, no server required.** Test individual functions and utilities:

- **YAML Parsing & Validation** (`utils/yaml-parser.test.ts`)
  - Valid/invalid YAML schemas
  - Zod validation errors
  - All conditional types (match, semantic, llm_judge, token_length)
  - Edge cases and optional fields

- **Display Utilities** (`utils/display.test.ts`)
  - Summary formatting
  - Pass/fail rate calculations
  - Success rate calculation and color coding
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

**Live server required.** Test against real vibecheck API:

- Full workflow validation
- Real API integration
- Actual model evaluations

**Note:** E2E tests are currently disabled pending setup of test helpers. See `tests/e2e/README.md` for setup instructions.

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

## CLI Output Format

The CLI provides rich, colored output:
- **Blue** - Prompts
- **Gray** - Responses
- **Green** - Passed items, high success rate
- **Yellow** - Moderate success rate (50-80%)
- **Red** - Failed items, low success rate

Summary uses GitHub-style diff notation:
```
eval-name-1  ----|+++++  ✅ in 2.3s
eval-name-2  ---|++++++  ✅ in 1.8s
```

Where `-` = failed conditional, `+` = passed conditional

## Common Commands

```bash
# Install all dependencies
npm install

# Build CLI
npm run build

# Build specific package
npm run build -w @vibecheck/shared
npm run build -w @vibe/cli

# Run CLI in dev mode
npm run dev

# Run CLI
npm run start -- check -f examples/hello-world.yaml

# Link CLI globally
cd packages/cli && npm link
vibe check -f examples/hello-world.yaml

# Run tests
npm test
npm run test:unit
npm run test:integration
npm run test:coverage

# Publish to npm
./scripts/publish.sh
```

## Important Notes

- The CLI supports both `vibe` and `vibes` commands (aliases)
- Documentation consistently uses `vibe` for clarity
- Exit code 1 when success rate < 50%
- Results are streamed in real-time via polling
- The CLI is **open source (MIT)** - encourage contributions!
- Get your API key at **vibescheck.io**

## Troubleshooting

**"API Error"** - Ensure your `VIBECHECK_API_KEY` is set correctly
**"Invalid YAML"** - Check YAML against schema in `@vibecheck/shared`
**Build errors** - Rebuild `@vibecheck/shared` first, then other packages
**Test failures** - Run `npm run test:unit && npm run test:integration` before committing

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

**Before submitting a PR:**
- Run tests: `npm test`
- Check coverage: `npm run test:coverage`
- Update documentation if needed

**Report Issues:**
- **API Problems**: File an issue with error details
- **Feature Requests**: Describe your use case
- **Bug Reports**: Include steps to reproduce