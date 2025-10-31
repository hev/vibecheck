# vibecheck CLI ✨

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/your-org/vibecheck/actions)
[![Coverage](https://img.shields.io/badge/coverage-80%25-green)](https://github.com/your-org/vibecheck)
[![npm version](https://img.shields.io/npm/v/vibecheck-cli)](https://www.npmjs.com/package/vibecheck-cli)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](https://opensource.org/licenses/Apache-2.0)

**An agent evaluation framework for any LLM** - A simple and intuitive YAML based DSL for language evals.

vibecheck makes it easy to evaluate any language model with a simple YAML configuration. Run evals,
save the results, and tweak your system prompts with incredibly tight feedback loop from the command line.

> 🎃 **Get Your Invite** 👻
>
> vibe check is currently being offered as an exclusive invite-only halloween pop up! Read our FAQ and summon your API key at [vibescheck.io](https://vibescheck.io).

## Installation

```bash
npm install -g vibecheck-cli
```

**Get your API key at [vibescheck.io](https://vibescheck.io)**

## Quick Start 

> 💡 Tip: Try the interactive onboarding experience
>
> ```bash
> vibe check
> ```
>
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
✨ hello-world  ----|+++++  ✅ in 2.3s

hello-world: ✨ good vibes (100% pass rate)
```

## CLI Commands

### `vibe check` - Run Evaluations
Run evaluations from a YAML file or saved suite.

```bash
vibe check -f hello-world.yaml
vibe check my-eval-suite
vibe check -f my-eval.yaml -m "anthropic/claude-3.5-sonnet,openai/gpt-4"
```

### `vibe stop` - Cancel Queued Runs
Stop/cancel a queued run that hasn't started executing yet.

```bash
vibe stop <run-id>
vibe stop run <run-id>  # Alternative syntax
vibe stop queued        # Cancel all queued runs
```

**Examples:**
```bash
vibe stop abc123-def456-ghi789
vibe stop run abc123-def456-ghi789
vibe stop queued
```

**Notes:**
- Only queued runs can be cancelled (not running, completed, or already cancelled)
- Run IDs can be found using `vibe get runs`
- Cancelled runs will show as "cancelled" status
- `vibe stop queued` will cancel all runs with "queued" status

### `vibe get` - List/Retrieve Resources
Get various resources with filtering options.

```bash
vibe get runs                    # List all runs
vibe get run <id>               # Get specific run details
vibe get suites                 # List saved suites
vibe get suite <name>           # Get specific suite
vibe get models                 # List available models
vibe get org                    # Organization info
vibe get vars                   # List all variables (name=value)
vibe get var <name>             # Get variable value
vibe get secrets                # List all secrets (names only)
```

### `vibe set` - Save Suites
Save an evaluation suite from a YAML file.

```bash
vibe set -f my-eval.yaml
```

### `vibe redeem` - Redeem Invite Codes
Redeem an invite code to create an organization and receive an API key.

```bash
vibe redeem <code>
```

### `vibe var` - Manage Runtime Variables
Manage org-scoped runtime variables that can be injected into evaluation YAML files.

```bash
vibe var set <name> <value>      # Set a variable
vibe var update <name> <value>   # Update a variable
vibe var get <name>              # Get a variable value (scripting-friendly)
vibe var list                    # List all variables (name=value format)
vibe var delete <name>           # Delete a variable
```

**Examples:**
```bash
vibe var set myvar "my value"
vibe var update myvar "updated value"
vibe var get myvar               # Prints: updated value
vibe var list                    # Prints: myvar=updated value
vibe var delete myvar
```

**Environment Variables:**
- `VIBECHECK_API_URL` or `API_BASE_URL` - API URL (default: `http://localhost:3000`)
- `VIBECHECK_API_KEY` or `API_KEY` - Organization API key (required)

### `vibe secret` - Manage Runtime Secrets
Manage org-scoped runtime secrets. Secret values are write-only (cannot be read), but you can list secret names. Secrets can be injected into evaluation YAML files.

```bash
vibe secret set <name> <value>      # Set a secret
vibe secret update <name> <value>  # Update a secret
vibe secret delete <name>          # Delete a secret
```

**Examples:**
```bash
vibe secret set mysecret "sensitive-value"
vibe secret update mysecret "new-sensitive-value"
vibe secret delete mysecret
vibe get secrets                   # List secret names (values not shown)
```

**Note:** Secret values are write-only for security reasons. You can list secret names with `vibe get secrets`, but individual secret values cannot be retrieved.

**Environment Variables:**
- `VIBECHECK_API_URL` or `API_BASE_URL` - API URL (default: `http://localhost:3000`)
- `VIBECHECK_API_KEY` or `API_KEY` - Organization API key (required)

## Featured Examples

### 🌍 Multilingual Testing
Test your model across 10+ languages with the same evaluation:

```yaml
# examples/multilingual-pbj.yaml
metadata:
  name: multilingual-pbj
  model: meta-llama/llama-4-maverick
  system_prompt: "You are a translator. Respond both in the language the question is asked as well as English."

evals:
  - prompt: "Describe how to make a peanut butter and jelly sandwich."
    checks:
      - match: "*bread*"
      - llm_judge:
          criteria: "Does this accurately describe how to make a peanut butter and jelly sandwich in English"
      - min_tokens: 20
      - max_tokens: 300

  - prompt: "Décrivez comment faire un sandwich au beurre d'arachide et à la confiture."
    checks:
      - match: "*pain*"
      - llm_judge:
          criteria: "Does this accurately describe how to make a peanut butter and jelly sandwich in French"
      - min_tokens: 20
      - max_tokens: 300
```

### 🔧 MCP Tool Integration
Validate MCP (Model Context Protocol) tool calling with external services:

```yaml
# examples/mcp-evals.yaml
metadata:
  name: mcp_tool_test
  model: anthropic/claude-3.5-sonnet
  system_prompt: |
    You are an AI assistant with access to external tools.
    Use the available tools to answer questions accurately.
  mcp_server:
    url: "https://your-mcp-server.com"
    name: "your-tool-server"
    authorization_token: "your-token"

evals:
  - prompt: "What's the weather like today?"
    checks:
      match: "*weather*"  # Should use weather tool
      min_tokens: 10
      max_tokens: 200
```

### 🧠 Advanced Evaluation Patterns
Combine multiple check types for comprehensive testing:

```yaml
# examples/hello-world.yaml
evals:
  - prompt: How are you today?
    checks:
      - semantic:
          expected: "I'm doing well, thank you for asking"
          threshold: 0.7
      - llm_judge:
          criteria: "Is this a friendly and appropriate response to 'How are you today?'"
      - min_tokens: 10
      - max_tokens: 100

  - prompt: What is 2+2?
    checks:
      - or:
          - match: "*4*"
          - match: "*four*"
      - llm_judge:
          criteria: "Is this a correct mathematical answer to 2+2?"
      - min_tokens: 1
      - max_tokens: 20
```

## YAML Syntax Reference

### Check Types

#### `match` - Glob Pattern Matching
Test if the response contains text matching a glob pattern.

```yaml
checks:
  - match: "*hello*"        # Contains "hello" anywhere
  - match: "hello*"         # Starts with "hello"
  - match: "*world"         # Ends with "world"
  # For multiple patterns, use multiple check objects
  - match: "*yes*"
  - match: "*ok*"
```

**Examples:**
- `match: "*hello*"` matches "Hello world", "Say hello", "hello there"
- `match: "The answer is*"` matches "The answer is 42" but not "Answer: 42"

#### `not_match` - Negated Patterns
Ensure the response does NOT contain certain text.

```yaml
checks:
  - not_match: "*error*"                    # Single pattern
  # For multiple patterns, use multiple check objects
  - not_match: "*error*"
  - not_match: "*sorry*"
```

**Examples:**
- `not_match: "*error*"` fails if response contains "error", "Error", "ERROR"
- Use multiple `not_match` checks for multiple patterns (all must not match)

#### `or` - Explicit OR Logic
Use when you want ANY of multiple patterns to pass.

```yaml
checks:
  or:                     # At least one must pass
    - match: "*yes*"
    - match: "*affirmative*"
    - match: "*correct*"
```

OR checks can be mixed with AND checks:
```yaml
checks:
  - min_tokens: 10          # AND (must pass)
  - or:                     # OR (one of these must pass)
      - match: "*hello*"
      - match: "*hi*"
```

#### `min_tokens` / `max_tokens` - Token Length Constraints
Control response length using token counting.

```yaml
checks:
  min_tokens: 10          # At least 10 tokens
  max_tokens: 100         # At most 100 tokens
```

#### `semantic` - Semantic Similarity
Compare response meaning using embeddings.

```yaml
checks:
  semantic:
    expected: "I'm doing well, thank you for asking"
    threshold: 0.8        # 0.0 to 1.0 similarity score
```

#### `llm_judge` - LLM-Based Evaluation
Use another LLM to judge response quality.

```yaml
checks:
  llm_judge:
    criteria: "Is this a helpful and accurate response to the question?"
```

### Check Logic

**AND Logic (Array Format)**: Multiple checks in an array must ALL pass
```yaml
checks:
  - match: "*hello*"        # AND
  - min_tokens: 5           # AND
  - max_tokens: 100         # AND
```

**OR Logic (Explicit)**: Use the `or:` field when you want ANY of the patterns to pass
```yaml
checks:
  or:                     # OR (at least one must pass)
    - match: "*yes*"
    - match: "*affirmative*"
    - match: "*correct*"
```

**Combined Logic**: Mix AND and OR logic
```yaml
checks:
  - min_tokens: 10          # AND (must pass)
  - or:                     # OR (one of these must pass)
      - match: "*hello*"
      - match: "*hi*"
```

### Metadata Configuration

```yaml
metadata:
  name: my-eval-suite     # Required: Suite name
  model: anthropic/claude-3.5-sonnet  # Required: Model to test
  system_prompt: "You are a helpful assistant"  # Optional: System prompt
  threads: 4              # Optional: Parallel threads for execution
  mcp_server:             # Optional: MCP server config
    url: "https://your-server.com"
    name: "server-name"
    authorization_token: "your-token"
```

> Note: For a one-time run of a saved suite, you can override any metadata at the command line (model, system prompt, threads, and MCP settings).

```bash
# Run a saved suite with one-time overrides
vibe check my-eval-suite \
  --model openai/gpt-4o \
  --system-prompt "You are a terse, helpful assistant." \
  --threads 8 \
  --mcp-url https://your-mcp-server.com \
  --mcp-name server-name \
  --mcp-token your-token
```

## Vibe Ratings

vibes breakdown as follows.

- ✨ **good vibes** = >80% pass rate
- 😬 **sketchy vibes** = 50-80% pass rate  
- 🚩 **bad vibes** = <50% pass rate

**Individual Check Results:**
- ✅ **PASS** - Check passed
- 🚩 **FAIL** - Check failed

**Exit Codes:**
- `0` - Good or sketchy vibes (≥50% pass rate)
- `1` - Bad vibes (<50% pass rate)

## Model Comparison & Scoring

vibecheck provides a comprehensive scoring system to help you compare models across multiple dimensions.

### Score Calculation

The **Score** column in `vibe get runs` combines three key factors:

```
Score = success_percentage / (cost * 1000 + duration_seconds * 0.1)
```

**Components:**
- **Success Rate**: Percentage of evaluations that passed
- **Cost Factor**: Total cost in dollars (multiplied by 1000 for scaling)
- **Latency Factor**: Duration in seconds (multiplied by 0.1 for small penalty)

**Higher scores indicate better overall performance** (more accurate, cheaper, and faster).

### Score Color Coding

- 🟢 **Green (≥1.0)**: Excellent performance
- 🟡 **Yellow (0.3-1.0)**: Good performance  
- 🔴 **Red (<0.3)**: Poor performance
- ⚪ **Gray (N/A)**: Cannot calculate (incomplete runs or missing cost data)

**Note**: Scores are only calculated for completed runs to ensure fair cost comparisons. Incomplete runs show "N/A" to avoid skewing results with partial token processing.

### Multi-Model Comparison

Run evaluations on multiple models using flexible selection patterns:

#### Comma-Delimited Models
```bash
# Run on specific models
vibe check -f my-eval.yaml -m "anthropic/claude-3.5-sonnet,openai/gpt-4"

# Mix and match any combination
vibe check -f my-eval.yaml -m "openai/gpt-4,anthropic/claude-3.5-sonnet,google/gemini-pro"
```

#### Wildcard Selection
```bash
# Run on all OpenAI models
vibe check -f my-eval.yaml -m "openai*"

# Run on multiple providers
vibe check -f my-eval.yaml -m "openai*,anthropic*"

# Mix wildcards and specific models
vibe check -f my-eval.yaml -m "openai*,anthropic/claude-3.5-sonnet"
```

#### Select All Models
```bash
# Run on all available models
vibe check -f my-eval.yaml -m all
```

#### Filter by Criteria
Combine selection with filters to narrow down:

```bash
# All $ models with MCP support
vibe check -f my-eval.yaml -m all --price 1 --mcp

# All OpenAI models in the cheapest quartile
vibe check -f my-eval.yaml -m openai* --price 1

# All Anthropic and Google models with MCP
vibe check -f my-eval.yaml -m "anthropic*,google*" --mcp
```

**View results sorted by score:**
```bash
vibe get runs --sort-by price-performance
```

### Sorting Options

Sort runs by different criteria:

```bash
vibe get runs --sort-by created          # Default: chronological
vibe get runs --sort-by success          # By success rate
vibe get runs --sort-by cost             # By total cost
vibe get runs --sort-by time             # By duration
vibe get runs --sort-by price-performance # By score (recommended)
```

---

**Wanna check the vibe?** Get started at [vibescheck.io](https://vibescheck.io) 🚀