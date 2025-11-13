# CLI Reference

Complete reference for all vibecheck CLI commands.

## Table of Contents

- [vibe check - Run Evaluations](#vibe-check---run-evaluations)
- [vibe stop - Cancel Queued Runs](#vibe-stop---cancel-queued-runs)
- [vibe get - List/Retrieve Resources](#vibe-get---listretrieve-resources)
- [vibe set - Save Suites](#vibe-set---save-suites)
- [vibe redeem - Redeem Invite Codes](#vibe-redeem---redeem-invite-codes)
- [vibe var - Manage Runtime Variables](#vibe-var---manage-runtime-variables)
- [vibe secret - Manage Runtime Secrets](#vibe-secret---manage-runtime-secrets)
- [Environment Variables](#environment-variables)

## `vibe check` - Run Evaluations

Run evaluations from a YAML file or saved suite.

### Basic Usage

```bash
vibe check -f hello-world.yaml
vibe check my-eval-suite
vibe check -f my-eval.yaml -m "anthropic/claude-3.5-sonnet,openai/gpt-4"
```

### Options

- `-f, --file <path>` - Path to YAML file
- `-m, --models <models>` - Comma-separated list of models or wildcard patterns
- `-a, --async` - Exit immediately after starting (non-blocking)
- `--model <model>` - Override model from YAML
- `--system-prompt <prompt>` - Override system prompt
- `--threads <number>` - Override parallel threads
- `--mcp-url <url>` - Override MCP server URL
- `--mcp-name <name>` - Override MCP server name
- `--mcp-token <token>` - Override MCP authorization token
- `--price <quartiles>` - Filter by price quartile (1-4, comma-separated)
- `--mcp` - Only use MCP-supported models
- `-d, --debug` - Enable debug logging

### Examples

```bash
# Run a local YAML file
vibe check -f examples/hello-world.yaml

# Run a saved suite
vibe check hello-world

# Run on multiple models
vibe check -f my-eval.yaml -m "openai/gpt-4,anthropic/claude-3.5-sonnet"

# Run on all OpenAI models
vibe check -f my-eval.yaml -m "openai*"

# Run on all models
vibe check -f my-eval.yaml -m all

# Run with overrides
vibe check my-suite --model openai/gpt-4o --system-prompt "You are a terse assistant"

# Non-blocking run
vibe check -f my-eval.yaml --async
```

## `vibe stop` - Cancel Queued Runs

Stop/cancel a queued run that hasn't started executing yet.

### Basic Usage

```bash
vibe stop <run-id>
vibe stop run <run-id>  # Alternative syntax
vibe stop queued        # Cancel all queued runs
```

### Examples

```bash
vibe stop abc123-def456-ghi789
vibe stop run abc123-def456-ghi789
vibe stop queued
```

### Notes

- Only queued runs can be cancelled (not running, completed, or already cancelled)
- Run IDs can be found using `vibe get runs`
- Cancelled runs will show as "cancelled" status
- `vibe stop queued` will cancel all runs with "queued" status

## `vibe get` - List/Retrieve Resources

Get various resources with filtering options.

### Runs

```bash
vibe get runs                    # List all runs
vibe get run <id>               # Get specific run details
vibe get runs --suite <name>    # Filter by suite
vibe get runs --status completed # Filter by status
vibe get runs --success-gt 80   # Filter by success rate
vibe get runs --time-lt 60      # Filter by duration
vibe get runs --limit 10        # Limit results
vibe get runs --offset 20       # Pagination offset
```

**Options:**
- `--suite <name>` - Filter by suite name
- `--status <status>` - Filter by status (queued, running, completed, cancelled)
- `--success-gt <number>` - Filter by success rate greater than
- `--success-lt <number>` - Filter by success rate less than
- `--time-gt <seconds>` - Filter by duration greater than
- `--time-lt <seconds>` - Filter by duration less than
- `--sort-by <field>` - Sort by field (created, success, cost, time, price-performance)
- `-l, --limit <number>` - Limit results (default: 50)
- `-o, --offset <number>` - Offset for pagination (default: 0)

### Suites

```bash
vibe get suites                 # List all suites
vibe get suite <name>          # Get specific suite
vibe get evals                 # Alias for suites
vibe get eval <name>           # Alias for suite
```

### Models

```bash
vibe get models                           # List all models
vibe get models --mcp                     # Only MCP-supported models
vibe get models --price 1,2               # Filter by price quartiles
vibe get models --provider anthropic,openai # Filter by providers
```

**Options:**
- `--mcp` - Only show MCP-supported models
- `--price <quartiles>` - Filter by price quartile (1-4, comma-separated)
- `--provider <providers>` - Filter by provider (comma-separated)

### Organization

```bash
vibe get org                    # Organization info
vibe get credits                # Credits/usage info
```

### Variables

```bash
vibe get vars                   # List all variables (name=value format)
vibe get var <name>             # Get specific variable value
```

### Secrets

```bash
vibe get secrets                # List all secrets (names only, no values)
vibe get secret <name>          # Error: Secret values cannot be read
```

**Note:** Secret values are write-only for security reasons. You can list secret names with `vibe get secrets`, but individual secret values cannot be retrieved.

## `vibe set` - Save Suites

Save an evaluation suite from a YAML file.

### Basic Usage

```bash
vibe set -f my-eval.yaml
vibe set -f my-eval.yaml --debug
```

### Options

- `-f, --file <path>` - Path to YAML file (required)
- `-d, --debug` - Enable debug logging

## `vibe redeem` - Redeem Invite Codes

Redeem an invite code to create an organization and receive an API key.

### Basic Usage

```bash
vibe redeem <code>
vibe redeem <code> --debug
```

### Arguments

- `<code>` - The invite code to redeem (required)

### Options

- `-d, --debug` - Enable debug logging

## `vibe var` - Manage Runtime Variables

Manage org-scoped runtime variables that can be injected into evaluation YAML files.

### Basic Usage

```bash
vibe var set <name> <value>      # Set a variable
vibe var update <name> <value>   # Update a variable
vibe var get <name>              # Get a variable value (scripting-friendly)
vibe var list                    # List all variables (name=value format)
vibe var delete <name>           # Delete a variable
```

### Examples

```bash
vibe var set myvar "my value"
vibe var update myvar "updated value"
vibe var get myvar               # Prints: updated value
vibe var list                    # Prints: myvar=updated value
vibe var delete myvar
```

### Usage in YAML

Variables can be injected into YAML files using template syntax:

```yaml
metadata:
  model: "{{var('model_name')}}"
  system_prompt: "{{var('system_role')}}"

evals:
  - prompt: "What is the status of {{var('project_name')}}?"
```

See [YAML Syntax Reference](./yaml-syntax.md#using-secrets-and-variables-in-yaml) for more details.

## `vibe secret` - Manage Runtime Secrets

Manage org-scoped runtime secrets. Secret values are write-only (cannot be read), but you can list secret names. Secrets can be injected into evaluation YAML files.

### Basic Usage

```bash
vibe secret set <name> <value>      # Set a secret
vibe secret update <name> <value>   # Update a secret
vibe secret delete <name>           # Delete a secret
```

### Examples

```bash
vibe secret set mysecret "sensitive-value"
vibe secret update mysecret "new-sensitive-value"
vibe secret delete mysecret
vibe get secrets                   # List secret names (values not shown)
```

### Usage in YAML

Secrets can be injected into YAML files using template syntax:

```yaml
metadata:
  mcp_server:
    url: "{{var('mcp_url')}}"
    authorization_token: "{{secret('api_token')}}"
```

**Note:** Secret values are write-only for security reasons. Once set, they cannot be retrieved via the CLI for security.

See [YAML Syntax Reference](./yaml-syntax.md#using-secrets-and-variables-in-yaml) for more details.

## Environment Variables

The vibecheck CLI uses the following environment variables:

### Required

- `VIBECHECK_API_KEY` or `API_KEY` - Your vibecheck API key (get one at [vibescheck.io](https://vibescheck.io))

### Optional

- `VIBECHECK_API_URL` or `API_BASE_URL` - API URL (default: `https://vibecheck-api-prod-681369865361.us-central1.run.app`)

### Configuration File

You can also create a configuration file at `~/.vibecheck/.env`:

```bash
# Create config directory
mkdir -p ~/.vibecheck

# Add your API key
echo "VIBECHECK_API_KEY=your-api-key-here" > ~/.vibecheck/.env

# Optional: Override API URL
echo "VIBECHECK_API_URL=https://your-custom-api.com" >> ~/.vibecheck/.env
```

---

[← Back to README](../README.md)
