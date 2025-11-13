# Example Tests

This directory contains tests that validate the `@vibecheck/runner` package by running all example YAML files from the `/examples` directory.

## Purpose

These tests serve multiple purposes:

1. **Integration Testing**: Verify that `@vibecheck/runner` correctly executes evaluation suites
2. **Example Validation**: Ensure all example files are valid and executable
3. **Smoke Testing**: Quick validation that the API is functioning
4. **Documentation**: Demonstrate real-world usage of the runner package

## Running the Tests

### Prerequisites

You must have a valid API key set. The tests will fail without authentication.

**Option 1: Environment variable**
```bash
export VIBECHECK_API_KEY=your-api-key
```

**Option 2: Config file**
```bash
echo "VIBECHECK_API_KEY=your-api-key" > ~/.vibecheck/.env
```

Get your API key at [vibescheck.io](https://vibescheck.io).

### Run All Examples

```bash
npm run test:examples
```

This will run all example evaluations in parallel (up to 10 concurrent runs).

### Run Specific Example

```bash
npm run test:examples -- -t "hello-world"
```

### Build First

The tests import from `@vibecheck/runner`, so ensure it's built:

```bash
npm run build
npm run test:examples
```

## What Gets Tested

The tests run these example files:

- ✅ `hello-world.yaml` - Basic pattern matching and token checks
- ✅ `finance.yaml` - Financial knowledge evaluation
- ✅ `healthcare.yaml` - Medical knowledge evaluation
- ✅ `lang.yaml` - Multilingual capabilities
- ✅ `politics.yaml` - Political knowledge evaluation
- ✅ `sports.yaml` - Sports knowledge evaluation
- ✅ `strawberry.yaml` - Reasoning capabilities
- ❌ `linear-mcp.yaml` - Excluded (requires MCP setup)

## Test Behavior

Each test:
1. Loads the YAML file using `@vibecheck/runner`
2. Executes the evaluation suite via the API
3. Waits for completion (up to 2 minutes per example)
4. Verifies results were returned
5. Logs success rate for visibility

**Note**: These tests verify that the runner *works*, not that examples achieve specific success rates. The examples define their own pass/fail criteria.

## Timeout

Each test has a 2-minute timeout to accommodate:
- API request time
- Model inference time
- Multiple evaluations per file
- Network latency

If tests timeout, check:
- API is reachable
- API key is valid
- Network connection is stable

## Parallel Execution

Tests run concurrently using Jest's `describe.concurrent()` for speed. The configuration limits concurrency to 10 simultaneous runs to avoid overwhelming the API.

## CI/CD Integration

These tests are automatically run on pull requests via GitHub Actions. See `.github/workflows/test-examples.yml`.

## Excluding Examples

To exclude an example from testing, simply remove it from the `examples` array in `examples.test.ts`:

```typescript
const examples = [
  { name: 'hello-world', expectation: 'basic checks' },
  // Remove or comment out to exclude:
  // { name: 'linear-mcp', expectation: 'MCP integration' },
];
```

## Troubleshooting

**Tests fail with "Authentication failed"**
- Check your API key is set correctly
- Verify the key hasn't expired
- Try running: `vibe get org` to test authentication

**Tests timeout**
- Increase timeout in `examples.test.ts` (default: 120000ms)
- Check API status at vibescheck.io
- Verify network connection

**Import errors**
- Run `npm run build` to build the runner package
- Check that `@vibecheck/runner` compiled successfully

**Tests pass but show low success rates**
- This is expected - examples test various capabilities
- Focus on whether the runner *executed* the tests, not the results
