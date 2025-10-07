# VibeCheck Project Guide

## Project Overview

VibeCheck is a vibe-themed CLI tool for running language model evaluations. It's built as a microservices architecture with a TypeScript monorepo structure.

## Architecture

### Packages

This is a monorepo managed with npm workspaces:

- **@evalit/cli** (`packages/cli`) - The main CLI interface
- **@evalit/api** (`packages/api`) - Express API server for evaluation processing
- **@evalit/semantic-checker** - Local embeddings service using @xenova/transformers
- **@evalit/shared** (`packages/shared`) - Shared TypeScript types and Zod schemas

### Languages & Tech Stack

- **Language**: TypeScript 5.3+
- **Runtime**: Node.js 20+
- **CLI Framework**: Commander.js
- **API Framework**: Express
- **Database**: SQLite (better-sqlite3)
- **Schema Validation**: Zod
- **LLM Provider**: OpenRouter API
- **Embeddings**: @xenova/transformers (all-MiniLM-L6-v2, local)
- **CLI Styling**: chalk, ora

## Project Structure

```
vibecheck/
├── packages/
│   ├── cli/              # CLI application
│   │   ├── src/
│   │   │   ├── index.ts           # Main entry point, commander setup
│   │   │   └── commands/
│   │   │       ├── run.ts         # vibe check command
│   │   │       └── suite.ts       # vibe get/set commands
│   │   └── package.json           # Bins: vibe, vibes
│   │
│   ├── api/              # API server
│   │   ├── src/
│   │   │   ├── index.ts           # Express app entry
│   │   │   ├── routes/
│   │   │   │   ├── eval.ts        # /api/eval/* endpoints
│   │   │   │   └── suite.ts       # /api/suite/* endpoints
│   │   │   ├── services/
│   │   │   │   ├── evalRunner.ts  # Orchestrates eval execution
│   │   │   │   ├── conditionals.ts # Conditional check logic
│   │   │   │   ├── openrouter.ts   # LLM API client
│   │   │   │   └── semanticChecker.ts # Local embeddings
│   │   │   └── db/
│   │   │       ├── index.ts       # Database connection
│   │   │       ├── schema.ts      # Table definitions
│   │   │       └── suiteOperations.ts # CRUD operations
│   │   └── package.json
│   │
│   └── shared/           # Shared types & schemas
│       ├── src/
│       │   ├── types.ts           # TypeScript types
│       │   └── index.ts           # Exports
│       └── package.json
│
├── examples/             # Example YAML eval files
├── .env                  # Environment variables (gitignored)
└── package.json          # Root workspace config
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
3. CLI sends eval suite to API (`POST /api/eval/run`)
4. API saves/updates suite in SQLite
5. API runs each evaluation sequentially:
   - Send prompt to OpenRouter
   - Check each conditional
   - Store results
6. CLI polls for results (`GET /api/eval/status/:runId`)
7. CLI displays streaming results with vibe-themed output
8. Exit code 1 if <80% pass rate

## Development Guidelines

### Build Order

Always build in this order due to dependencies:
1. `@evalit/shared` (other packages depend on this)
2. `@evalit/api`
3. `@evalit/cli`

Or use: `npm run build` (runs in correct order)

### Running Locally

**Development mode:**
```bash
# Terminal 1 - API server
npm run api

# Terminal 2 - CLI
npm run cli -- check -f examples/evals.yaml
```

**Or concurrently:**
```bash
npm run dev  # Runs API in watch mode
```

### Environment Variables

Required in `.env` at project root:
```bash
OPENROUTER_API_KEY=sk-or-v1-xxxxx
```

Optional:
```bash
PORT=3000                      # API port
DATABASE_PATH=./evalit.db      # SQLite DB location
EVALIT_API_URL=http://localhost:3000  # CLI API endpoint
```

### Database

SQLite database is created automatically on first run. Tables:
- `suites` - Evaluation suite metadata
- `eval_runs` - Run history
- `eval_results` - Individual eval results
- `conditional_results` - Conditional check results

### Adding New Conditionals

1. Add type to shared types (`packages/shared/src/types.ts`)
2. Update Zod schema in shared package
3. Implement check logic in `packages/api/src/services/conditionals.ts`
4. Rebuild shared package: `npm run build -w @evalit/shared`

## Common Commands

```bash
# Install all dependencies
npm install

# Build everything
npm run build

# Build specific package
npm run build -w @evalit/shared
npm run build -w @evalit/api
npm run build -w @evalit/cli

# Run API in dev mode
npm run api

# Run CLI
npm run cli -- check -f examples/evals.yaml

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
- Semantic similarity uses local embeddings (no API calls)
- All LLM inference goes through OpenRouter
- Database stores complete history for analysis

## Testing

Run evaluations against your prompts:
```bash
vibe check -f examples/evals.yaml
```

The suite passes if ≥80% of evaluations pass.

## Troubleshooting

**"API Error"** - Ensure API server is running on port 3000
**"Invalid YAML"** - Check YAML against schema in `@evalit/shared`
**Semantic similarity slow on first run** - Model downloads once (~90MB)
**Build errors** - Rebuild `@evalit/shared` first, then other packages
