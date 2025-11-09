# Running GitHub Actions Locally with `act`

This repository is configured to run GitHub Actions locally using [act](https://github.com/nektos/act).

**The GitHub Actions workflow** (`.github/workflows/test.yml`) runs automatically on pull requests and pushes to `main`/`master` branches. You can test it locally before pushing!

## Quick Start

```bash
# Run all workflows (simulates a pull request)
act pull_request

# Run only the test job
act pull_request -j test

# Run only the lint job
act pull_request -j lint
```

## Common Commands

```bash
# List all available workflows and jobs
act -l

# Run with verbose output (see what's happening)
act pull_request -v

# Dry run (see what would be executed without running)
act pull_request -n

# Run a specific matrix combination (Node 20.x)
act pull_request -j test --matrix node-version:20.x
```

## Configuration

The `.actrc` file configures act for optimal performance on your machine:
- Uses `linux/amd64` architecture for M-series Macs
- Uses optimized Ubuntu image for faster execution
- Skips secret validation (not needed for tests)

## First Run

The first time you run `act`, it will:
1. Download Docker images (~2-3GB)
2. This takes 5-10 minutes
3. Subsequent runs are much faster (seconds)

## Troubleshooting

### "Cannot connect to Docker daemon"
Make sure Docker Desktop is running.

### Slow performance
First run downloads images. Subsequent runs are fast.

### Codecov upload fails
This is expected - Codecov action requires GitHub secrets. The workflow has `continue-on-error: true`, so it won't fail the build.

### Tests fail that pass locally
Try rebuilding containers: `act pull_request --rebuild`

## Manual Testing (Faster Alternative)

For quick validation without Docker overhead:

```bash
# Replicate CI workflow manually
npm ci                      # Fresh install
npm run build              # Build
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:ci            # With coverage
```

## When to Use What

**Use `act` when:**
- You want to verify the exact CI environment
- Testing workflow changes
- Before opening a PR

**Use manual commands when:**
- Quick iteration during development
- Debugging test failures
- Faster feedback loop

## Resources

- [act documentation](https://github.com/nektos/act)
- [GitHub Actions documentation](https://docs.github.com/en/actions)
