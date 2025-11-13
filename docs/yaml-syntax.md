# YAML Syntax Reference

Complete reference for vibecheck YAML evaluation syntax.

## Table of Contents

- [Check Types](#check-types)
  - [match - Glob Pattern Matching](#match---glob-pattern-matching)
  - [not_match - Negated Patterns](#not_match---negated-patterns)
  - [or - Explicit OR Logic](#or---explicit-or-logic)
  - [min_tokens / max_tokens - Token Length Constraints](#min_tokens--max_tokens---token-length-constraints)
  - [semantic - Semantic Similarity](#semantic---semantic-similarity)
  - [llm_judge - LLM-Based Evaluation](#llm_judge---llm-based-evaluation)
- [Check Logic](#check-logic)
- [Metadata Configuration](#metadata-configuration)
- [Using Secrets and Variables](#using-secrets-and-variables-in-yaml)

## Check Types

### `match` - Glob Pattern Matching

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

### `not_match` - Negated Patterns

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

### `or` - Explicit OR Logic

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

### `min_tokens` / `max_tokens` - Token Length Constraints

Control response length using token counting.

```yaml
checks:
  min_tokens: 10          # At least 10 tokens
  max_tokens: 100         # At most 100 tokens
```

### `semantic` - Semantic Similarity

Compare response meaning using embeddings.

```yaml
checks:
  semantic:
    expected: "I'm doing well, thank you for asking"
    threshold: 0.8        # 0.0 to 1.0 similarity score
```

### `llm_judge` - LLM-Based Evaluation

Use another LLM to judge response quality.

```yaml
checks:
  llm_judge:
    criteria: "Is this a helpful and accurate response to the question?"
```

## Check Logic

### AND Logic (Array Format)

Multiple checks in an array must ALL pass:

```yaml
checks:
  - match: "*hello*"        # AND
  - min_tokens: 5           # AND
  - max_tokens: 100         # AND
```

### OR Logic (Explicit)

Use the `or:` field when you want ANY of the patterns to pass:

```yaml
checks:
  or:                     # OR (at least one must pass)
    - match: "*yes*"
    - match: "*affirmative*"
    - match: "*correct*"
```

### Combined Logic

Mix AND and OR logic:

```yaml
checks:
  - min_tokens: 10          # AND (must pass)
  - or:                     # OR (one of these must pass)
      - match: "*hello*"
      - match: "*hi*"
```

## Metadata Configuration

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

**Note:** For a one-time run of a saved suite, you can override any metadata at the command line (model, system prompt, threads, and MCP settings).

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

## Using Secrets and Variables in YAML

You can inject secrets and variables into your YAML evaluation files using template syntax. This allows you to:
- Keep sensitive values (like API tokens) secure using secrets
- Share configuration values across multiple evaluation files using variables
- Update values without modifying YAML files

### Template Syntax

- Secrets: `{{secret('secret-name')}}`
- Variables: `{{var('var-name')}}`

### Example: Using secrets and vars in metadata

First, set up your secrets and variables:

```bash
# Set a secret (sensitive, write-only)
vibe set secret api_token "sk-1234567890abcdef"

# Set variables (readable, can be used for non-sensitive config)
vibe set var model_name "anthropic/claude-3.5-sonnet"
vibe set var system_role "You are a helpful assistant"
```

Then use them in your YAML:

```yaml
metadata:
  name: my-eval-suite
  model: "{{var('model_name')}}"
  system_prompt: "{{var('system_role')}}"
  mcp_server:
    url: "{{var('mcp_url')}}"
    authorization_token: "{{secret('api_token')}}"
```

### Example: Using vars in evaluation prompts

```bash
vibe set var company_name "Acme Corp"
vibe set var project_name "Project Alpha"
```

```yaml
evals:
  - prompt: "List all issues for {{var('project_name')}} at {{var('company_name')}}"
    checks:
      - match: "*{{var('project_name')}}*"
      - min_tokens: 10
```

### Key Points

- Secrets are **write-only** (values cannot be read for security)
- Variables are **readable** (you can view values with `vibe get var <name>`)
- Template resolution happens **at runtime** when evaluations run
- If a secret or variable is not found, the evaluation will fail with a clear error message
- Use quotes around template expressions in YAML: `"{{secret('name')}}"` or `"{{var('name')}}"`

---

[← Back to README](../README.md)
