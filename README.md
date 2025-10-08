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
- Checks your conditionals (runs the tests)
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
    conditionals:
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

## Environment Variables

Create a `.env` file in the project root:

```bash
VIBECHECK_API_KEY=your-api-key-here  # Get from vibescheck.io
```

Optional:
- `EVALIT_API_URL` - API server URL (default: https://vibescheck.io/api)

## Architecture

This is the CLI component of the VibeCheck platform:

- **@evalit/cli** - The vibe-checking CLI (this repo)
- **@evalit/shared** - Shared TypeScript types and Zod schemas
- **VibeCheck API** - API service at vibescheck.io (get your API key there)

## Contributing

Contributions are welcome! This is the open-source CLI component.

## License

MIT
