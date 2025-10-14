# VibeCheck CLI ✨

A vibe-themed CLI for running language model evaluations. Check your LLM's vibes with conditional testing!

**Open Source** | **MIT Licensed**

## Quick Start

**Get your API key at [vibescheck.io](https://vibescheck.io)**

### Installation

1. Install dependencies:
```bash
npm install
```

2. Build all packages:
```bash
npm run build
```

3. Link the CLI (optional - for global usage):
```bash
cd packages/cli
npm link
```

## CLI Usage

The CLI is accessed via the `vibe` command (or `vibes` - both work!):

### Check Vibes (Run Evaluations)

Run evaluations from a YAML file - this is where the magic happens! ✨

```bash
vibe check -f examples/evals.yaml
```

This command:
- Checks your checks (runs the tests)
- Shows real-time vibe ratings
- Gives you the final verdict

**Vibe Ratings:**
- ✨ **good vibes** = 100% pass rate
- 😬 **sketchy vibes** = ≥80% pass rate
- 🚩 **bad vibes** = <80% pass rate

**Individual Conditional Results:**
- ✅ **PASS** - conditional passed
- 🚩 **FAIL** - conditional failed

Exit codes:
- Exits with code 1 if vibe rating is below 80%
- Exits with code 0 for good or sketchy vibes

### Set/Save a Suite

Save an evaluation suite from a YAML file:

```bash
vibe set -f eval.yaml
```

### Get Suites

List all saved suites:

```bash
vibe get
```

Get a specific suite by name:

```bash
vibe get <suite-name>
```

## YAML Format

Create evaluation files in YAML format. Example structure:

```yaml
metadata:
  name: my-eval-suite
  model: anthropic/claude-3.5-sonnet
  systemPrompt: You are a helpful assistant

evaluations:
  - name: test-1
    prompt: What is 2+2?
    checks:
      - type: string_contains
        value: "4"
      - type: token_length
        min: 1
        max: 100
```

See `examples/` directory for more examples.

## Features

- ✨ Vibe-themed output and terminology
- 🎯 Multiple conditional types:
  - `string_contains` - Check if response contains specific text
  - `semantic_similarity` - Compare semantic meaning
  - `llm_judge` - Use LLM to evaluate response quality
  - `token_length` - Validate response length
- 🌊 Streaming results in real-time
- 📊 Visual summary with +/- bar charts
- 🎨 Colored CLI output (prompts in blue, responses in gray, status indicators)

## Development

The CLI can be developed independently:

```bash
# Watch mode for CLI development
npm run dev

# Build the CLI
npm run build

# Run the CLI
npm run start -- check -f examples/evals.yaml
```

## Configuration

Create a configuration file at `~/.vibecheck/.env`:

```bash
# Required: Get your API key at https://vibescheck.io
VIBECHECK_API_KEY=your-api-key-here

# Optional: Override the API URL (defaults to http://localhost:3000)
VIBECHECK_URL=http://localhost:3000
```

Quick setup:
```bash
mkdir -p ~/.vibecheck
cp .env.example ~/.vibecheck/.env
# Then edit ~/.vibecheck/.env with your API key
```

The CLI uses bearer token authentication. All API requests include:
```
Authorization: Bearer <VIBECHECK_API_KEY>
```

If the API key is missing or invalid, you'll see:
- **401 Unauthorized**: Invalid or missing API key
- **500 Server Error**: The VibeCheck API encountered an error

## Architecture

This is the CLI component of the VibeCheck platform:

- **@evalit/cli** - The vibe-checking CLI (this repo)
- **@evalit/shared** - Shared TypeScript types and Zod schemas
- **VibeCheck API** - API service at vibescheck.io (get your API key there)

## Contributing

Contributions are welcome! This is the open-source CLI component.

## License

MIT
