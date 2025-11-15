---
name: vibecheck-cli
description: Run vibecheck CLI commands to execute evals, manage suites, view runs, and manage runtime variables/secrets
---

# Vibecheck CLI

Use this skill when the user wants to run evaluations, manage suites, view results, or work with runtime variables and secrets.

## When to Use

- User wants to run an evaluation suite
- User asks to save, retrieve, or list suites
- User wants to view past runs or filter them
- User needs to set/get/delete variables or secrets
- User wants to see available models or org info

## Quick Commands

### Run Evaluations
```bash
# Auto-detect eval file (looks for evals.yaml, eval.yaml, etc.)
vibe check

# Run specific file
vibe check -f path/to/eval.yaml

# Run asynchronously (non-blocking)
vibe check -f eval.yaml --async
```

### Manage Suites
```bash
# Save a suite
vibe set suite -f my-eval.yaml

# List all suites
vibe get suites

# Get specific suite
vibe get suite my-suite-name
```

### View Runs
```bash
# List recent runs
vibe get runs

# Get specific run
vibe get runs <run-id>

# Filter by suite
vibe get runs --suite my-suite

# Filter by status
vibe get runs --status completed

# Filter by success rate (>80%)
vibe get runs --success-gt 80

# Filter by duration (<60s)
vibe get runs --time-lt 60

# Pagination
vibe get runs --limit 10 --offset 20
```

### Runtime Variables
```bash
# Set or update a variable
vibe set var model_name "anthropic/claude-3.5-sonnet"

# List all variables
vibe get vars

# Get specific variable value
vibe get var model_name

# Delete a variable
vibe delete var model_name
```

### Runtime Secrets
```bash
# Set or update a secret (write-only)
vibe set secret api_token "sk-..."

# List secret names (values not readable)
vibe get secrets

# Delete a secret
vibe delete secret api_token
```

### Other Commands
```bash
# List available models
vibe get models

# Filter MCP-supported models
vibe get models --mcp

# Filter by provider
vibe get models --provider anthropic,openai

# View organization info
vibe get org
vibe get credits
```

## Important Notes

1. **API Key Required**: Set `VIBECHECK_API_KEY` in `~/.vibecheck/.env`
2. **Exit Codes**: Returns exit code 1 if success rate < 50%
3. **Auto-detection**: `vibe check` looks for `evals.yaml`, `eval.yaml`, `evals.yml`, or `eval.yml`
4. **Secrets**: Secret values are write-only and cannot be read back
5. **Variables**: Variable values are readable via `vibe get var <name>`

## Setup

```bash
# Create config directory and set API key
mkdir -p ~/.vibecheck
echo "VIBECHECK_API_KEY=your-api-key-here" > ~/.vibecheck/.env

# Get API key at https://vibescheck.io
```

## Common Workflows

### Running and Saving
```bash
# Run an eval file
vibe check -f my-eval.yaml

# If it works well, save it as a suite
vibe set suite -f my-eval.yaml
```

### Using Variables in Evals
```bash
# Set runtime variables
vibe set var model_name "anthropic/claude-3.5-sonnet"
vibe set var project_name "my-project"

# Use in YAML with {{var('name')}} syntax
vibe check -f eval-with-vars.yaml

# List all variables
vibe get vars
```

### Reviewing Results
```bash
# View recent runs
vibe get runs --limit 20

# Filter by suite
vibe get runs --suite my-suite

# Get detailed run info
vibe get runs <run-id>
```

## Output Format

Results use color coding:
- **Green** (✅): >80% pass rate
- **Yellow**: 50-80% pass rate
- **Red** (❌): <50% pass rate

Summary uses GitHub-style notation:
```
eval-1  ----|+++++  ✅ in 2.3s
```
Where `-` = failed check, `+` = passed check
