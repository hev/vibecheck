# @vibecheck/runner

Programmatic runner for vibecheck evaluations. Run vibe checks directly in your Jest tests.

## Installation

```bash
npm install --save-dev @vibecheck/runner
```

## Quick Start

### Basic Usage

```typescript
import { runVibeCheck } from '@vibecheck/runner';

const results = await runVibeCheck({
  file: './evals/hello-world.yaml'
});

console.log(`Passed: ${results.filter(r => r.passed).length}/${results.length}`);
```

### With Jest

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

  it('should have 80%+ success rate', async () => {
    const results = await runVibeCheck({
      file: './evals/my-feature.yaml'
    });

    expect(results).toHaveSuccessRateAbove(80);
  });
});
```

## Configuration

### API Key

The runner requires a vibecheck API key. Get yours at [vibescheck.io](https://vibescheck.io).

Set your API key using one of these methods:

1. **Environment variable:**
```bash
export VIBECHECK_API_KEY=your-api-key
```

2. **Config file:** `~/.vibecheck/.env`
```
VIBECHECK_API_KEY=your-api-key
```

3. **Constructor option:**
```typescript
import { VibeCheckRunner } from '@vibecheck/runner';

const runner = new VibeCheckRunner({
  apiKey: 'your-api-key'
});
```

### API URL (Optional)

To test against localhost or a custom API:

```typescript
const runner = new VibeCheckRunner({
  apiKey: 'your-api-key',
  apiUrl: 'http://localhost:3000'
});
```

Or via environment variable:
```bash
export VIBECHECK_URL=http://localhost:3000
```

## API Reference

### `runVibeCheck(options)`

Convenience function to run a vibe check.

```typescript
const results = await runVibeCheck({
  file: './evals/test.yaml',
  model: 'anthropic/claude-3.5-sonnet', // Optional override
  apiKey: 'your-api-key',               // Optional
  apiUrl: 'http://localhost:3000'       // Optional
});
```

### `VibeCheckRunner`

Main runner class for advanced usage.

```typescript
import { VibeCheckRunner } from '@vibecheck/runner';

const runner = new VibeCheckRunner({
  apiKey: 'your-api-key',
  apiUrl: 'http://localhost:3000' // Optional
});

// Run evaluation
const results = await runner.run({
  file: './evals/test.yaml'
});

// Run on multiple models
const results = await runner.run({
  file: './evals/test.yaml',
  models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4']
});

// Start async run
const runId = await runner.startRun({
  file: './evals/test.yaml'
});

// Check status later
const status = await runner.getStatus(runId);

// Wait for completion
const results = await runner.waitForCompletion(runId);
```

## Jest Matchers

The package includes custom Jest matchers for evaluating vibe check results:

### `toHavePassedAll()`

Asserts that all evaluations passed.

```typescript
expect(results).toHavePassedAll();
```

### `toHaveSuccessRateAbove(threshold)`

Asserts that the success rate is above the threshold (0-100).

```typescript
expect(results).toHaveSuccessRateAbove(80);
```

### `toHaveSuccessRateBelow(threshold)`

Asserts that the success rate is below the threshold (0-100).

```typescript
expect(results).toHaveSuccessRateBelow(50);
```

### `toHavePassedCount(count)`

Asserts that exactly `count` evaluations passed.

```typescript
expect(results).toHavePassedCount(5);
```

### `toHaveFailedCount(count)`

Asserts that exactly `count` evaluations failed.

```typescript
expect(results).toHaveFailedCount(2);
```

## Examples

### Testing Multiple Models

```typescript
import { runVibeCheck } from '@vibecheck/runner';

describe('Multi-model testing', () => {
  it('should work on multiple models', async () => {
    const results = await runVibeCheck({
      file: './evals/test.yaml',
      models: [
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4',
        'anthropic/claude-3-haiku'
      ]
    });

    // Results from all models
    expect(results.length).toBeGreaterThan(0);
  });
});
```

### Model Override

```typescript
import { runVibeCheck } from '@vibecheck/runner';

describe('Model override', () => {
  it('should use specified model', async () => {
    // Override model from YAML
    const results = await runVibeCheck({
      file: './evals/test.yaml',
      model: 'openai/gpt-4'
    });

    expect(results).toHavePassedAll();
  });
});
```

### Programmatic Suite

```typescript
import { VibeCheckRunner } from '@vibecheck/runner';

const runner = new VibeCheckRunner();

const results = await runner.run({
  suite: {
    metadata: {
      name: 'inline-test',
      model: 'anthropic/claude-3.5-sonnet',
      system_prompt: 'You are a helpful assistant'
    },
    evals: [
      {
        prompt: 'What is 2+2?',
        checks: [
          { match: '*4*' },
          { min_tokens: 1 },
          { max_tokens: 100 }
        ]
      }
    ]
  }
});
```

## TypeScript Support

The package is written in TypeScript and includes full type definitions.

```typescript
import {
  VibeCheckRunner,
  EvalResult,
  EvalSuite,
  RunOptions,
  RunnerConfig
} from '@vibecheck/runner';
```

## Error Handling

The runner throws descriptive errors:

```typescript
try {
  const results = await runVibeCheck({
    file: './evals/test.yaml'
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof NetworkError) {
    console.error('Cannot connect to API');
  } else if (error instanceof ValidationError) {
    console.error('Invalid YAML format');
  } else {
    console.error('Evaluation failed:', error.message);
  }
}
```

## License

MIT

## Links

- [vibecheck Homepage](https://vibescheck.io)
- [GitHub Repository](https://github.com/hev/vibecheck)
- [CLI Package](https://www.npmjs.com/package/vibecheck-cli)
- [Documentation](https://github.com/hev/vibecheck#readme)
