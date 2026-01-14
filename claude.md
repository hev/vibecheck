# vibecheck Project Guide

vibecheck is a vibe-themed CLI tool for running language model evaluations. Open source (MIT) CLI connecting to vibescheck.io API.

**Get your API key at [vibescheck.io](https://vibescheck.io)**

## Architecture

Monorepo with npm workspaces:
- **@vibe/cli** (`packages/cli`) - Main CLI interface
- **@vibecheck/shared** (`packages/shared`) - Shared TypeScript types and Zod schemas

**Tech Stack:** TypeScript 5.3+, Node.js 20+, Commander.js, Zod, chalk, ora

## Project Structure

```
vibecheck/
├── packages/cli/              # CLI application
│   ├── src/
│   │   ├── index.ts           # Commander setup
│   │   ├── commands/          # vibe check, set, get, delete, redeem
│   │   └── utils/             # display, config, auth-error
│   └── package.json           # Bins: vibe, vibes
├── packages/shared/           # Shared types & Zod schemas
├── examples/                  # Example YAML eval files
├── tests/                     # Unit, integration, e2e tests
└── scripts/publish.sh         # Publishing script
```

## Key Concepts

### Commands (vibe <verb> <noun> pattern)

```bash
vibe check -f eval.yaml          # Run evals
vibe set suite -f eval.yaml      # Save suite
vibe get runs --suite name       # View runs
vibe set var name value          # Set variable
vibe set secret name value       # Set secret
vibe delete var name             # Delete variable
vibe get models                  # List models
vibe get org                     # Org info
vibe redeem <code>               # Redeem invite
```

### Evaluation Suite Format

```yaml
metadata:
  name: suite-name
  model: anthropic/claude-3.5-sonnet
  system_prompt: Optional prompt  # optional
  mcp_server:  # optional
    url: "https://mcp-server.com"
    name: "server-name"
    authorization_token: "token"

evals:
  - prompt: Question to ask
    checks:
      - match: "*expected*"           # glob/regex pattern
      - not_match: "*unwanted*"       # negated pattern
      - or:                           # OR logic
          - match: "*yes*"
          - match: "*affirmative*"
      - min_tokens: 10
      - max_tokens: 100
      - semantic:                     # embeddings
          expected: "target"
          threshold: 0.8
      - llm_judge:                    # LLM judge
          criteria: "what to judge"
```

### Check Logic

**AND:** Array items must ALL pass
```yaml
checks:
  - match: "*hello*"
  - min_tokens: 5
```

**OR:** At least one must pass
```yaml
checks:
  or:
    - match: "*yes*"
    - match: "*ok*"
```

## Development

### Development Workflow

**Always follow:** Research (optional) → Plan (with todos) → Build (with tests)

**Testing Requirements:**
- Add tests for new features
- Run tests before completing tasks
- Maintain 80%+ coverage for critical paths

### Running Locally

```bash
npm install                    # Install deps
npm run build                  # Build all packages
npm run dev                    # Watch mode
npm run start -- check -f examples/hello-world.yaml

# Link globally
npm run build:link
vibe check -f examples/hello-world.yaml
```

### Testing

```bash
npm test                       # All tests
npm run test:unit              # Unit tests (fast, isolated)
npm run test:integration       # Integration tests (mocked API)
npm run test:coverage          # Coverage report
npm run test:watch             # Watch mode
```

**Test Structure:**
- **Unit** (`packages/cli/src/**/*.test.ts`) - Functions, no server
- **Integration** (`tests/integration/`) - Full commands, mocked API (nock)
- **E2E** (`tests/e2e/`) - Live API (currently disabled)

**Pre-commit:** Run `npm run test:unit && npm run test:integration`

### Build Order

1. `@vibecheck/shared` (types/schemas)
2. `@vibe/cli` (CLI)

Or use: `npm run build` (correct order)

### Publishing

```bash
./scripts/publish.sh              # npm + prompt for Homebrew
./scripts/publish.sh --npm-only   # npm only
./scripts/publish.sh --auto-homebrew  # npm + Homebrew
```

Script handles: git validation, tests, build, version bump, npm publish, Homebrew tap

### Environment

`~/.vibecheck/.env`:
```bash
VIBECHECK_API_KEY=your-key       # Required (get at vibescheck.io)
VIBECHECK_URL=https://...        # Optional (override API URL)
```

Setup: `mkdir -p ~/.vibecheck && echo "VIBECHECK_API_KEY=key" > ~/.vibecheck/.env`

### Authentication

Bearer token auth: `Authorization: Bearer <VIBECHECK_API_KEY>`
- **401**: Invalid/missing API key
- **500**: API error

### Adding Check Types

1. Add type to `packages/shared/src/types.ts`
2. Update Zod schema in shared package
3. Rebuild: `npm run build -w @vibecheck/shared`

Server-side implementation handled by vibecheck API.

## CLI Details

### Output Format

**Color coding:**
- Green (>80%): High success
- Yellow (50-80%): Moderate success
- Red (<50%): Low success

**Summary format:**
```
eval-1  ----|+++++  ✅ in 2.3s
```
`-` = failed check, `+` = passed check

### Exit Codes

Exit code 1 when success rate < 50%

### Auto-detection

`vibe check` looks for: `evals.yaml`, `eval.yaml`, `evals.yml`, `eval.yml`

### Secrets vs Variables

- **Variables**: Readable via `vibe get var <name>`
- **Secrets**: Write-only, cannot read values

## Common Tasks

```bash
# Build
npm run build

# Build specific package
npm run build -w @vibecheck/shared

# Dev mode
npm run dev

# Link globally
cd packages/cli && npm link

# Tests
npm test
npm run test:unit
npm run test:integration

# Publish
./scripts/publish.sh
```

## Troubleshooting

- **"API Error"**: Check `VIBECHECK_API_KEY` in `~/.vibecheck/.env`
- **"Invalid YAML"**: Validate against schema in `@vibecheck/shared`
- **Build errors**: Rebuild `@vibecheck/shared` first
- **Test failures**: Run `npm run test:unit && npm run test:integration`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

**Before PR:**
- Run `npm test`
- Check `npm run test:coverage`
- Update docs if needed

**Report issues with:**
- API problems: Error details
- Feature requests: Use case
- Bug reports: Reproduction steps

## Notes

- CLI supports `vibe` and `vibes` commands (aliases)
- Documentation uses `vibe` for consistency
- Results streamed real-time via polling
- Open source (MIT) - contributions welcome
- Get API key at **vibescheck.io**
