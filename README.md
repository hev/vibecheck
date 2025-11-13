# vibecheck CLI

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/your-org/vibecheck/actions)
[![Coverage](https://img.shields.io/badge/coverage-80%25-green)](https://github.com/your-org/vibecheck)
[![npm version](https://img.shields.io/npm/v/vibecheck-cli)](https://www.npmjs.com/package/vibecheck-cli)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](https://opensource.org/licenses/Apache-2.0)

**An agent evaluation framework for any LLM** - A simple and intuitive YAML based DSL for language evals.

vibecheck makes it easy to evaluate any language model with a simple YAML configuration. Run evals, save the results, and tweak your system prompts with incredibly tight feedback loop from the command line.

> **Get Your Invite**
>
> vibe check is currently being offered as an invite-only developer preview! Read our FAQ and request your API key at [vibescheck.io](https://vibescheck.io).

## Installation

```bash
npm install -g vibecheck-cli
```

**Get your API key at [vibescheck.io](https://vibescheck.io)**

## Quick Start

Create a simple evaluation file:

```yaml
# hello-world.yaml
metadata:
  name: hello-world
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: Say hello
    checks:
      - match: "*hello*"
      - min_tokens: 1
      - max_tokens: 50
```

Run the evaluation:

```bash
vibe check -f hello-world.yaml
```

**Output:**
```
hello-world  ----|+++++  ✅ in 2.3s

hello-world: Success Pct: 2/2 (100.0%)
```

## Documentation

### Core Documentation

- **[YAML Syntax Reference](./docs/yaml-syntax.md)** - Complete guide to evaluation syntax and check types
- **[CLI Reference](./docs/cli-reference.md)** - All CLI commands, options, and flags
- **[Examples](./docs/examples.md)** - Featured examples and best practices
- **[Model Comparison & Scoring](./docs/model-comparison.md)** - Compare models and understand scoring
- **[Programmatic API](./docs/programmatic-api.md)** - Use vibecheck in your code and tests

### Quick Links

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Essential Commands](#essential-commands)
- [Featured Examples](#featured-examples)
- [YAML Syntax Reference](#yaml-syntax-reference)

## Essential Commands

### Run Evaluations

```bash
vibe check -f hello-world.yaml                    # Run from file
vibe check my-suite                               # Run saved suite
vibe check -f my-eval.yaml -m "openai*,anthropic*" # Multi-model comparison
```

[→ Full CLI Reference](./docs/cli-reference.md)

### Manage Suites

```bash
vibe set -f my-eval.yaml        # Save a suite
vibe get suites                 # List all suites
vibe get suite <name>          # Get specific suite
```

### View Results

```bash
vibe get runs                           # List all runs
vibe get runs --sort-by price-performance # Compare models by score
vibe get runs --suite my-suite         # Filter by suite
```

### Manage Variables & Secrets

```bash
vibe var set <name> <value>      # Set a variable
vibe secret set <name> <value>   # Set a secret (write-only)
vibe get vars                    # List all variables
```

[→ Full CLI Reference](./docs/cli-reference.md)

## Featured Examples

### 🌍 Multilingual Testing

Test your model across 10+ languages:

```yaml
metadata:
  name: multilingual-pbj
  model: meta-llama/llama-4-maverick
  system_prompt: "You are a translator. Respond both in the language the question is asked as well as English."

evals:
  - prompt: "Describe how to make a peanut butter and jelly sandwich."
    checks:
      - match: "*bread*"
      - llm_judge:
          criteria: "Does this accurately describe how to make a PB&J in English"
      - min_tokens: 20
      - max_tokens: 300
```

### 🔧 MCP Tool Integration

Test MCP tool calling with secure configuration:

```bash
# Set up secrets and variables
vibe set secret linear.apiKey "your-api-key"
vibe set var linear.projectId "your-project-id"

# Run the evaluation
vibe check linear-mcp
```

### 🧠 Advanced Patterns

Combine multiple check types:

```yaml
evals:
  - prompt: How are you today?
    checks:
      - semantic:
          expected: "I'm doing well, thank you for asking"
          threshold: 0.7
      - llm_judge:
          criteria: "Is this a friendly and appropriate response?"
      - min_tokens: 10
      - max_tokens: 100
```

[→ More Examples](./docs/examples.md)

## YAML Syntax Reference

vibecheck evaluations are defined in YAML with a simple, intuitive syntax.

### Quick Reference

**Check Types:**
- `match` - Glob pattern matching
- `not_match` - Negated patterns
- `or` - OR logic for multiple patterns
- `min_tokens` / `max_tokens` - Token length constraints
- `semantic` - Semantic similarity using embeddings
- `llm_judge` - LLM-based quality evaluation

**Example:**

```yaml
metadata:
  name: my-eval
  model: anthropic/claude-3.5-sonnet

evals:
  - prompt: What is 2+2?
    checks:
      - or:
          - match: "*4*"
          - match: "*four*"
      - min_tokens: 1
      - max_tokens: 20
```

[→ Full YAML Syntax Reference](./docs/yaml-syntax.md)

## Model Comparison

Run evaluations on multiple models and compare results:

```bash
# Run on specific models
vibe check -f my-eval.yaml -m "openai/gpt-4,anthropic/claude-3.5-sonnet"

# Run on all OpenAI models
vibe check -f my-eval.yaml -m "openai*"

# Run on all models
vibe check -f my-eval.yaml -m all

# View results sorted by score
vibe get runs --sort-by price-performance
```

[→ Model Comparison Guide](./docs/model-comparison.md)

## Programmatic API

Use vibecheck in your code and tests:

```typescript
import { runVibeCheck } from '@vibecheck/runner';
import { extendExpect } from '@vibecheck/runner/jest';

extendExpect(expect);

describe('My LLM Feature', () => {
  it('should pass all vibe checks', async () => {
    const results = await runVibeCheck({
      file: './evals/my-feature.yaml'
    });

    expect(results).toHavePassedAll();
  });
});
```

[→ Programmatic API Guide](./docs/programmatic-api.md)

## Success Rates

Success rates are displayed as percentages with color coding:

- **Green** (>80% pass rate) - High success rate
- **Yellow** (50-80% pass rate) - Moderate success rate
- **Red** (<50% pass rate) - Low success rate

**Individual Check Results:**
- ✅ **PASS** - Check passed
- ❌ **FAIL** - Check failed

**Exit Codes:**
- `0` - Moderate or high success rate (≥50% pass rate)
- `1` - Low success rate (<50% pass rate)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

**Development Setup:**

```bash
# Install dependencies
npm install

# Build packages
npm run build

# Run tests
npm test

# Run CLI locally
npm run start -- check -f examples/hello-world.yaml
```

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.

---

**Wanna check the vibe?** Get started at [vibescheck.io](https://vibescheck.io) 🚀
