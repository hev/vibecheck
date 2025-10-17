# E2E Tests

End-to-end tests for VibeCheck CLI that test against a live server.

## ⚠️ Requirements

E2E tests require:
- A running VibeCheck server (local or remote)
- Valid API credentials
- Test helper utilities (see below)

## Current Status

The e2e test file `vibecheck-cli.test.ts` has been moved to this directory but requires additional setup:

1. **Test helpers** need to be created in `tests/e2e/utils/testHelpers.ts` with:
   - `ensureServerRunning(port)` - Verify server is accessible
   - `createTestOrg(adminApiKey)` - Create test organization
   - `deleteTestOrg(orgName)` - Clean up test organization
   - `runVibeCheckCommand(args)` - Execute CLI commands
   - `TestOrg` type definition

2. **Test fixtures** need to be created in `tests/e2e/fixtures/`:
   - `integration-test.yaml` - Test evaluation suite

## Running E2E Tests

Once setup is complete:

```bash
# Ensure server is running
npm run test:e2e
```

## Alternative: Skip E2E Tests

For local development without a running server:

```bash
# Run only unit and integration tests
npm run test:unit && npm run test:integration
```

## TODO

- [ ] Create test helper utilities
- [ ] Create test fixtures for e2e
- [ ] Document server setup requirements
- [ ] Add CI/CD integration with test server
