# VibeCheck Project Guide

## Project Overview

VibeCheck is a vibe-themed CLI tool for running language model evaluations. This is the open source CLI tool (MIT licensed) that connects to the VibeCheck API at vibescheck.io.

**Get your API key at [vibescheck.io](https://vibescheck.io)**

## Architecture

This is a monorepo managed with npm workspaces:

- **@evalit/cli** (`packages/cli`) - The main CLI interface (open source)
- **@evalit/shared** (`packages/shared`) - Shared TypeScript types and Zod schemas

### Languages & Tech Stack

- **Language**: TypeScript 5.3+
- **Runtime**: Node.js 20+
- **CLI Framework**: Commander.js
- **Schema Validation**: Zod
- **CLI Styling**: chalk, ora
- **API**: VibeCheck API at vibescheck.io

## Project Structure

```
vibecheck/
├── packages/                      # CLI packages
│   ├── cli/                       # CLI application (open source)
│   │   ├── src/
│   │   │   ├── index.ts           # Main entry point, commander setup
│   │   │   └── commands/
│   │   │       ├── run.ts         # vibe check command
│   │   │       └── suite.ts       # vibe get/set commands
│   │   └── package.json           # Bins: vibe, vibes
│   │
│   └── shared/                    # Shared types & schemas (open source)
│       ├── src/
│       │   ├── types.ts           # TypeScript types
│       │   └── index.ts           # Exports
│       └── package.json
│
├── examples/                      # Example YAML eval files
├── claude.md                      # This file
├── .cursorrules                   # Symlink to claude.md
├── README.md                      # Main documentation
└── package.json                   # Root workspace config
```

## Key Concepts

### Vibe-Themed Terminology

This project uses playful internet slang terminology:

**Command Structure:**
- `vibe check` (or `vibes check`) - Run evaluations
- `vibe get` - List or retrieve suites
- `vibe set` - Save a suite

**Results:**
- ✨ **good vibes** = 100% pass rate
- 😬 **sketchy vibes** = ≥80% pass rate
- 🚩 **bad vibes** = <80% pass rate

**Individual Conditionals:**
- ✅ **white flag** = PASS (conditional passed)
- 🚩 **red flag** = FAIL (conditional failed)

### Evaluation Suite Format

Evaluation suites are defined in YAML:

```yaml
metadata:
  name: suite-name
  model: anthropic/claude-3.5-sonnet
  systemPrompt: You are a helpful assistant

evaluations:
  - name: eval-1
    prompt: Question to ask the model
    conditionals:
      - type: string_contains
        value: "expected text"
      - type: semantic_similarity
        target: "semantic target"
        threshold: 0.8
      - type: llm_judge
        criteria: "what to judge"
      - type: token_length
        min: 10
        max: 100
```

### Conditional Types

1. **string_contains** - Check if response contains exact text
2. **semantic_similarity** - Compare semantic meaning using embeddings (local)
3. **llm_judge** - Use an LLM to judge the response quality
4. **token_length** - Validate response is within token bounds

### Workflow

1. User runs `vibe check -f eval.yaml`
2. CLI validates YAML with Zod schemas
3. CLI sends eval suite to VibeCheck API
4. API runs each evaluation and checks conditionals
5. CLI polls for results and displays streaming output
6. Exit code 1 if <80% pass rate

## Development Guidelines

### Build Order

Build packages in this order:
1. `@evalit/shared`
2. `@evalit/cli`

Or use: `npm run build` (runs in correct order)

### Running Locally

```bash
# Build and run CLI
npm run build
npm run start -- check -f examples/evals.yaml

# Or watch mode
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required: Get your API key at https://vibescheck.io
VIBECHECK_API_KEY=your-api-key-here

# Optional: Override the API URL (defaults to http://localhost:3000)
VIBECHECK_URL=http://localhost:3000
```

### Authentication

The CLI uses **bearer token authentication** for all API requests:
- All requests include: `Authorization: Bearer <VIBECHECK_API_KEY>`
- The API key is validated on every request
- Missing or invalid API keys result in 401 errors

Error handling:
- **401 Unauthorized**: Invalid or missing API key
- **500 Server Error**: The VibeCheck API encountered an error

### Adding New Conditional Types

1. Add type to shared types (`packages/shared/src/types.ts`)
2. Update Zod schema in shared package
3. Rebuild shared package: `npm run build -w @evalit/shared`

Note: Server-side conditional implementation is handled by the VibeCheck API.

## Common Commands

```bash
# Install all dependencies
npm install

# Build CLI
npm run build

# Build specific package
npm run build -w @evalit/shared
npm run build -w @evalit/cli

# Run CLI in dev mode
npm run dev

# Run CLI
npm run start -- check -f examples/evals.yaml

# Link CLI globally
cd packages/cli && npm link
vibe check -f examples/evals.yaml
```

## CLI Output Format

The CLI provides rich, colored output:
- **Blue** - Prompts
- **Gray** - Responses
- **Green** - Passed items, good vibes
- **Yellow** - Sketchy vibes (≥80%)
- **Red** - Failed items, bad vibes

Summary uses GitHub-style diff notation:
```
eval-name-1  ----|+++++  ✅ in 2.3s
eval-name-2  ---|++++++  ✅ in 1.8s
```

Where `-` = failed conditional, `+` = passed conditional

## Important Notes

- The CLI supports both `vibe` and `vibes` commands (aliases)
- Documentation consistently uses `vibe` for clarity
- Exit code 1 when vibe rating < 80%
- Results are streamed in real-time via polling
- The CLI is **open source (MIT)** - encourage contributions!
- Get your API key at **vibescheck.io**

## Testing

Run evaluations against your prompts:
```bash
vibe check -f examples/evals.yaml
```

The suite passes if ≥80% of evaluations pass.

## Troubleshooting

**"API Error"** - Ensure your `VIBECHECK_API_KEY` is set correctly
**"Invalid YAML"** - Check YAML against schema in `@evalit/shared`
**Build errors** - Rebuild `@evalit/shared` first, then other packages
