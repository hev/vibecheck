---
name: vibecheck-eval-writer
description: Write vibecheck evaluation suites in YAML format with proper syntax, check types, and template variables
---

# Vibecheck Eval Writer

Use this skill when the user wants to create or modify vibecheck evaluation YAML files.

## When to Use

- User wants to create a new evaluation suite
- User needs to add checks or modify existing evals
- User asks about check types or syntax
- User wants to use template variables or secrets
- User needs help with complex check logic (AND/OR)

## File Structure

```yaml
metadata:
  name: suite-name                      # Required: kebab-case name
  model: provider/model-name            # Required: e.g., anthropic/claude-3.5-sonnet
  system_prompt: "You are..."           # Optional: System instructions
  threads: 4                            # Optional: Parallel execution (default: 4)
  mcp_server:                           # Optional: MCP server config
    url: "https://..."
    name: "server-name"
    authorization_token: "..."

evals:
  - prompt: "Question or task"
    checks:
      - match: "*expected pattern*"
      - not_match: "*unwanted*"
      - min_tokens: 10
      - max_tokens: 100
      - or:
          - match: "*option1*"
          - match: "*option2*"
      - semantic:
          expected: "semantic meaning"
          threshold: 0.8
      - llm_judge:
          criteria: "judgment criteria"
```

## Check Types

### 1. Pattern Matching

**match** - Text must contain pattern (glob or regex):
```yaml
- match: "*hello*"           # Contains "hello"
- match: "hello*"            # Starts with "hello"
- match: "*world"            # Ends with "world"
- match: "exact"             # Exact match
- match: ".*regex.*"         # Regex pattern
```

**not_match** - Text must NOT contain pattern:
```yaml
- not_match: "*error*"       # Must not contain "error"
- not_match: "*sorry*"       # Must not contain "sorry"
```

### 2. Token Constraints

```yaml
- min_tokens: 10             # At least 10 tokens
- max_tokens: 100            # At most 100 tokens
```

### 3. Semantic Similarity

Compare semantic meaning using embeddings (runs locally):
```yaml
- semantic:
    expected: "The capital of France is Paris"
    threshold: 0.8           # 0.0-1.0 similarity score
```

### 4. LLM Judge

Use an LLM to evaluate response quality:
```yaml
- llm_judge:
    criteria: "Response is polite and professional"
```

## Logic Operators

### AND Logic (Default)

Multiple checks in an array = ALL must pass:
```yaml
checks:
  - match: "*solution*"      # Must pass
  - min_tokens: 20           # AND must pass
  - not_match: "*error*"     # AND must pass
```

### OR Logic (Explicit)

Use `or:` field = ANY must pass:
```yaml
checks:
  or:
    - match: "*yes*"
    - match: "*affirmative*"
    - match: "*correct*"
```

### Combined AND/OR

Mix both for complex logic:
```yaml
checks:
  - min_tokens: 10           # Must pass (AND)
  - or:                      # One of these must pass
      - match: "*hello*"
      - match: "*hi*"
  - not_match: "*error*"     # Must pass (AND)
```

## Template Variables

### Variable Syntax

- **Variables**: `{{var('name')}}` - Readable runtime values
- **Secrets**: `{{secret('name')}}` - Write-only secure values

### Using Templates

```yaml
metadata:
  model: "{{var('model_name')}}"
  system_prompt: "{{var('system_role')}}"
  mcp_server:
    authorization_token: "{{secret('mcp_token')}}"

evals:
  - prompt: "List issues for {{var('project_name')}}"
    checks:
      - match: "*{{var('expected_keyword')}}*"
```

### Managing Variables

```bash
# Set variables (readable)
vibe set var model_name "anthropic/claude-3.5-sonnet"
vibe set var project_name "my-project"

# Set secrets (write-only)
vibe set secret mcp_token "sk-..."

# List
vibe get vars              # Shows name=value
vibe get secrets           # Shows names only
```

### Template Rules

1. **Always quote** template expressions: `"{{var('name')}}"`
2. **Secrets** are write-only (cannot be read back)
3. **Variables** are readable
4. Templates resolve at runtime when eval runs

## Common Patterns

### Multiple Acceptable Responses
```yaml
- prompt: "Is the sky blue?"
  checks:
    or:
      - match: "*yes*"
      - match: "*affirmative*"
      - match: "*correct*"
```

### Enforce Length with Content
```yaml
- prompt: "Explain quantum computing"
  checks:
    - match: "*quantum*"
    - match: "*superposition*"
    - min_tokens: 50
    - max_tokens: 200
```

### Avoid Unwanted Content
```yaml
- prompt: "Provide a solution"
  checks:
    - match: "*solution*"
    - not_match: "*error*"
    - not_match: "*sorry*"
    - not_match: "*cannot*"
```

### Quality Checks
```yaml
- prompt: "Write a professional email"
  checks:
    - min_tokens: 30
    - llm_judge:
        criteria: "Email is polite, professional, and well-formatted"
    - not_match: "*yo*"
    - not_match: "*hey*"
```

### Semantic Validation
```yaml
- prompt: "What is the capital of France?"
  checks:
    - semantic:
        expected: "Paris is the capital of France"
        threshold: 0.85
    - min_tokens: 3
```

## Model Format

Models use `provider/model-name` format:

```yaml
# Anthropic models
model: anthropic/claude-3.5-sonnet
model: anthropic/claude-3-opus

# OpenAI models
model: openai/gpt-4
model: openai/gpt-4-turbo

# Other providers
model: google/gemini-pro
```

Use `vibe get models` to see all available models.

## MCP Server Configuration

For Model Context Protocol servers:

```yaml
metadata:
  mcp_server:
    url: "https://api.example.com"
    name: "my-mcp-server"
    authorization_token: "{{secret('mcp_token')}}"  # Use secrets for tokens
```

## Best Practices

1. **Start Simple**: Begin with basic `match` checks, add complexity as needed
2. **Use OR for Flexibility**: Accept multiple valid responses with `or:`
3. **Combine Checks**: Use both content and length checks together
4. **Secure Tokens**: Always use `{{secret('...')}}` for API keys/tokens
5. **Test Locally**: Run `vibe check -f eval.yaml` to test before saving
6. **Descriptive Names**: Use clear, descriptive suite names (kebab-case)
7. **System Prompts**: Add system prompts to guide model behavior
8. **Semantic for Meaning**: Use `semantic` when exact wording doesn't matter
9. **LLM Judge for Quality**: Use `llm_judge` for subjective quality checks

## Key Rules

- All metadata fields use `snake_case`
- Suite names use `kebab-case`
- Model format: `provider/model-name`
- Quote template expressions: `"{{var('name')}}"`
- Case-insensitive pattern matching by default
- Glob patterns: `*` = wildcard, no regex needed for simple patterns
- Regex: Use `.*` syntax for advanced patterns
