# Programmatic API

Use vibecheck programmatically in your code and tests with the `@vibecheck/runner` package.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Jest Integration](#jest-integration)
- [API Reference](#api-reference)
- [Example Tests](#example-tests)

## Installation

Install the runner package as a dev dependency:

```bash
npm install --save-dev @vibecheck/runner
```

## Basic Usage

Run vibe checks directly in your code:

```typescript
import { runVibeCheck } from '@vibecheck/runner';

const results = await runVibeCheck({
  file: './examples/hello-world.yaml'
});

console.log(`Passed: ${results.filter(r => r.passed).length}/${results.length}`);
```

### Options

The `runVibeCheck` function accepts the following options:

```typescript
interface RunOptions {
  file: string;           // Path to YAML file (required)
  model?: string;         // Override model from YAML
  systemPrompt?: string;  // Override system prompt
  threads?: number;       // Override parallel threads
  async?: boolean;        // Non-blocking mode
}
```

### Return Value

Returns an array of evaluation results:

```typescript
interface EvalResult {
  prompt: string;         // The evaluation prompt
  response: string;       // Model's response
  passed: boolean;        // Whether all checks passed
  checks: CheckResult[];  // Individual check results
  duration: number;       // Duration in seconds
}

interface CheckResult {
  type: string;          // Check type (match, semantic, etc.)
  passed: boolean;       // Whether the check passed
  message?: string;      // Optional error message
}
```

## Jest Integration

Extend Jest with custom matchers for vibecheck:

```typescript
import { runVibeCheck } from '@vibecheck/runner';
import { extendExpect } from '@vibecheck/runner/jest';

// Extend Jest with custom matchers
extendExpect(expect);

describe('My LLM Feature', () => {
  it('should pass all vibe checks', async () => {
    const results = await runVibeCheck({
      file: './evals/my-feature.yaml'
    });

    expect(results).toHavePassedAll();
  });

  it('should have high success rate', async () => {
    const results = await runVibeCheck({
      file: './evals/my-feature.yaml'
    });

    expect(results).toHaveSuccessRateAbove(0.8);
  });
});
```

### Available Jest Matchers

The `@vibecheck/runner/jest` module provides the following matchers:

#### `toHavePassedAll()`

Assert that all evaluations passed:

```typescript
expect(results).toHavePassedAll();
```

**Fails with:** List of failed evaluations and their reasons.

#### `toHaveSuccessRateAbove(threshold)`

Assert success rate is above a threshold (0.0 to 1.0):

```typescript
expect(results).toHaveSuccessRateAbove(0.8);  // 80%
expect(results).toHaveSuccessRateAbove(0.5);  // 50%
```

**Fails with:** Actual success rate and which evaluations failed.

#### `toHaveSuccessRateBelow(threshold)`

Assert success rate is below a threshold (useful for negative tests):

```typescript
expect(results).toHaveSuccessRateBelow(0.5);  // Less than 50%
```

**Fails with:** Actual success rate.

#### `toHavePassedCount(count)`

Assert exact number of passed evaluations:

```typescript
expect(results).toHavePassedCount(5);
```

**Fails with:** Actual passed count and list of results.

#### `toHaveFailedCount(count)`

Assert exact number of failed evaluations:

```typescript
expect(results).toHaveFailedCount(2);
```

**Fails with:** Actual failed count and list of results.

### Example Test Suite

Here's a complete example test suite:

```typescript
import { runVibeCheck } from '@vibecheck/runner';
import { extendExpect } from '@vibecheck/runner/jest';

extendExpect(expect);

describe('LLM Evaluation Suite', () => {
  describe('Hello World', () => {
    it('should pass all checks', async () => {
      const results = await runVibeCheck({
        file: './evals/hello-world.yaml'
      });

      expect(results).toHavePassedAll();
    });
  });

  describe('Multilingual', () => {
    it('should have 90% success rate', async () => {
      const results = await runVibeCheck({
        file: './evals/multilingual.yaml'
      });

      expect(results).toHaveSuccessRateAbove(0.9);
    });
  });

  describe('Performance', () => {
    it('should complete in under 30 seconds', async () => {
      const start = Date.now();

      await runVibeCheck({
        file: './evals/performance.yaml'
      });

      const duration = (Date.now() - start) / 1000;
      expect(duration).toBeLessThan(30);
    });
  });

  describe('Specific Model', () => {
    it('should pass with GPT-4', async () => {
      const results = await runVibeCheck({
        file: './evals/my-feature.yaml',
        model: 'openai/gpt-4'
      });

      expect(results).toHavePassedAll();
    });
  });
});
```

## API Reference

### `runVibeCheck(options)`

Run a vibe check evaluation.

**Parameters:**
- `options: RunOptions` - Configuration options

**Returns:**
- `Promise<EvalResult[]>` - Array of evaluation results

**Example:**
```typescript
const results = await runVibeCheck({
  file: './my-eval.yaml',
  model: 'openai/gpt-4',
  systemPrompt: 'You are a helpful assistant',
  threads: 4
});
```

### `extendExpect(expect)`

Extend Jest's `expect` with vibecheck matchers.

**Parameters:**
- `expect: Jest.Expect` - Jest's expect object

**Example:**
```typescript
import { extendExpect } from '@vibecheck/runner/jest';

extendExpect(expect);
```

## Example Tests

The vibecheck repository includes automated tests that run all example evaluations. These demonstrate best practices for testing with the runner package.

### Running Example Tests

```bash
# Set your API key first
export VIBECHECK_API_KEY=your-api-key

# Build and run examples
npm run build
npm run test:examples
```

### What Gets Tested

The example tests run all examples in parallel:

- ✅ `hello-world.yaml` - Basic checks
- ✅ `finance.yaml` - Financial knowledge
- ✅ `healthcare.yaml` - Medical knowledge
- ✅ `lang.yaml` - Multilingual capabilities
- ✅ `politics.yaml` - Political knowledge
- ✅ `sports.yaml` - Sports knowledge
- ✅ `strawberry.yaml` - Reasoning capabilities

### Example Test Implementation

See [tests/examples/README.md](../tests/examples/README.md) for the complete test implementation.

```typescript
// tests/examples/run-examples.test.ts
import { runVibeCheck } from '@vibecheck/runner';
import { extendExpect } from '@vibecheck/runner/jest';

extendExpect(expect);

describe('Example Evaluations', () => {
  const examples = [
    'hello-world.yaml',
    'finance.yaml',
    'healthcare.yaml',
    'lang.yaml',
    'politics.yaml',
    'sports.yaml',
    'strawberry.yaml'
  ];

  examples.forEach((example) => {
    it(`should pass ${example}`, async () => {
      const results = await runVibeCheck({
        file: `./examples/${example}`
      });

      expect(results).toHavePassedAll();
    }, 60000); // 60 second timeout
  });
});
```

### CI/CD Integration

Example tests are automatically run on pull requests via GitHub Actions:

```yaml
# .github/workflows/test-examples.yml
name: Test Examples

on:
  pull_request:
    branches: [main]

jobs:
  test-examples:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run build
      - run: npm run test:examples
        env:
          VIBECHECK_API_KEY: ${{ secrets.VIBECHECK_API_KEY }}
```

## Full Package Documentation

For complete API documentation, see the [runner package README](../packages/runner/README.md).

---

[← Back to README](../README.md) | [Examples](./examples.md)
