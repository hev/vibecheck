# Vibecheck YAML Syntax

Reference for writing vibecheck evaluation YAML files.

## File Structure

```yaml
metadata:
  name: suite-name                # Required
  model: provider/model-name      # Required
  system_prompt: "..."            # Optional
  threads: 4                      # Optional
  mcp_server:                     # Optional
    url: "https://..."
    name: "server-name"
    authorization_token: "..."

evals:
  - prompt: "Question text"
    checks:
      - match: "*pattern*"
      - not_match: "*unwanted*"
      - min_tokens: 10
      - max_tokens: 100
      - or:
          - match: "*option1*"
          - match: "*option2*"
      - semantic:
          expected: "target meaning"
          threshold: 0.8
      - llm_judge:
          criteria: "judgment criteria"
```

## Check Types

### Pattern Matching
- **match**: `"*hello*"` - Contains "hello" (glob pattern)
- **not_match**: `"*error*"` - Must NOT contain "error"
- Case-insensitive by default

### Token Constraints
- **min_tokens**: Minimum token count (e.g., `10`)
- **max_tokens**: Maximum token count (e.g., `100`)

### Semantic & LLM
- **semantic**: Compare meaning via embeddings
  - `expected`: Target text
  - `threshold`: 0.0-1.0 similarity score
- **llm_judge**: Use LLM to evaluate quality
  - `criteria`: What to judge

## Logic Operators

### AND Logic (default)
Multiple checks in array = ALL must pass:
```yaml
checks:
  - match: "*hello*"    # AND
  - min_tokens: 5       # AND
```

### OR Logic (explicit)
Use `or:` field = ANY must pass:
```yaml
checks:
  or:
    - match: "*yes*"
    - match: "*ok*"
```

### Combined AND/OR
```yaml
checks:
  - min_tokens: 10      # AND (required)
  - or:                 # OR (one of these)
      - match: "*hi*"
      - match: "*hello*"
```

## Template Variables

### Syntax
- Secrets: `{{secret('name')}}`
- Variables: `{{var('name')}}`

### Example
```yaml
metadata:
  model: "{{var('model_name')}}"
  system_prompt: "{{var('system_role')}}"
  mcp_server:
    authorization_token: "{{secret('api_token')}}"

evals:
  - prompt: "List issues for {{var('project_name')}}"
    checks:
      - match: "*{{var('company_name')}}*"
```

### CLI Commands
```bash
vibe set var model_name "anthropic/claude-3.5-sonnet"
vibe set secret api_token "sk-..."
vibe get vars              # List all variables
vibe get var model_name    # Get specific variable
vibe get secrets           # List secret names only
vibe delete var name
vibe delete secret name
```

## Common Patterns

### Multiple acceptable responses
```yaml
checks:
  or:
    - match: "*yes*"
    - match: "*affirmative*"
    - match: "*correct*"
```

### Enforce length with content
```yaml
checks:
  - match: "*detailed explanation*"
  - min_tokens: 50
  - max_tokens: 200
```

### Avoid unwanted content
```yaml
checks:
  - match: "*solution*"
  - not_match: "*error*"
  - not_match: "*sorry*"
```

## Key Rules

- Quotes required around template expressions: `"{{var('name')}}"`
- Secrets are write-only (cannot be read)
- Variables are readable
- All metadata fields use snake_case
- Model format: `provider/model-name`
- Templates resolve at runtime
