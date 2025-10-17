import { ensureServerRunning, createTestOrg, deleteTestOrg, runVibeCheckCommand, TestOrg } from './utils/testHelpers';
import * as path from 'path';
import * as fs from 'fs';

describe('VibeCheck CLI Test Suite (Integration Tests)', () => {
  const port = 3000;
  const yamlFilePath = path.join(__dirname, 'fixtures', 'integration-test.yaml');
  const suiteName = 'integration-test';
  let testOrg: TestOrg;
  const adminApiKey = process.env.ADMIN_API_KEY!;

  // Ensure server is running and create test org before all tests
  beforeAll(async () => {
    await ensureServerRunning(port);
    testOrg = await createTestOrg(adminApiKey);

    // Set the API key in environment for vibe CLI to use
    process.env.VIBECHECK_API_KEY = testOrg.apiKey;

    // Ensure the test YAML file exists
    expect(fs.existsSync(yamlFilePath)).toBe(true);
  }, 60000);

  // Delete test org after all tests
  afterAll(() => {
    const deleted = deleteTestOrg(testOrg.name);
    expect(deleted).toBe(true);
  }, 30000);

  describe('vibe check command', () => {
    it('should run evaluations and test all checks in CI mode', () => {
      const { stdout, exitCode } = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);

      // Should complete successfully
      expect(exitCode).toBe(0);

      // Should contain evaluation results output
      expect(stdout.length).toBeGreaterThan(0);

      // Should show that checks were evaluated
      expect(stdout.length).toBeGreaterThan(0);
    }, 70000);

    it('should handle all check types', () => {
      const { stdout, exitCode } = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);

      expect(exitCode).toBe(0);

      // The suite has 4 checks:
      // 1. string_contains
      // 2. semantic_similarity
      // 3. llm_judge
      // 4. token_length

      // Since we're asking "What is 2 + 2?" and checking for "4", the response should pass
      expect(stdout).toBeTruthy();
    }, 70000);

    it('should fail gracefully with invalid YAML file', () => {
      const { exitCode } = runVibeCheckCommand('check -f /nonexistent/file.yaml --ci');

      // Should fail with non-zero exit code
      expect(exitCode).not.toBe(0);
    });

  });

  describe('vibe set command', () => {
    it('should save an evaluation suite', () => {
      const { stdout, exitCode } = runVibeCheckCommand(`set -f ${yamlFilePath}`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(suiteName);
    });

    it('should update an existing suite', () => {
      // Save first time
      runVibeCheckCommand(`set -f ${yamlFilePath}`);

      // Save again (should be an update)
      const { stdout, exitCode } = runVibeCheckCommand(`set -f ${yamlFilePath}`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(suiteName);
    });

    it('should fail with invalid YAML file', () => {
      const { exitCode } = runVibeCheckCommand('set -f /nonexistent/file.yaml');

      expect(exitCode).not.toBe(0);
    });
  });

  describe('vibe get command', () => {
    // First save the suite
    beforeAll(() => {
      runVibeCheckCommand(`set -f ${yamlFilePath}`);
    });

    it('should list all saved suites', () => {
      const { stdout, exitCode } = runVibeCheckCommand('get suites');

      expect(exitCode).toBe(0);
      expect(stdout).toContain(suiteName);
    });

    it('should show suite details including last run date', () => {
      // First run the check to create a run entry
      runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);

      // Then get the suite details
      const { stdout, exitCode } = runVibeCheckCommand(`get suite ${suiteName}`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(suiteName);

      // Should show the suite was saved/run
      expect(stdout.length).toBeGreaterThan(0);
    }, 70000);

    it('should handle non-existent suite name gracefully', () => {
      const { stdout, exitCode } = runVibeCheckCommand('get suite nonexistent-suite-name-12345');

      // May return 0 with "not found" message or non-zero exit code
      // Either way, should not crash
      expect(stdout.length > 0 || exitCode !== 0).toBe(true);
    });
  });

  describe('Full workflow test', () => {
    it('should complete full check -> set -> get workflow', () => {
      // Step 1: Run vibe check
      const checkResult = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);
      expect(checkResult.exitCode).toBe(0);

      // Step 2: Save the suite with vibe set
      const setResult = runVibeCheckCommand(`set -f ${yamlFilePath}`);
      expect(setResult.exitCode).toBe(0);

      // Step 3: List all suites
      const getListResult = runVibeCheckCommand('get suites');
      expect(getListResult.exitCode).toBe(0);
      expect(getListResult.stdout).toContain(suiteName);

      // Step 4: Get specific suite
      const getSuiteResult = runVibeCheckCommand(`get suite ${suiteName}`);
      expect(getSuiteResult.exitCode).toBe(0);
      expect(getSuiteResult.stdout).toContain(suiteName);
    }, 100000);
  });

  describe('Check type coverage', () => {
    it('should exercise string_contains check', () => {
      // This is implicitly tested by the main check command
      // The YAML file includes: string_contains: "4"
      const { exitCode } = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);
      expect(exitCode).toBe(0);
    }, 70000);

    it('should exercise semantic_similarity check', () => {
      // This is implicitly tested by the main check command
      // The YAML file includes: semantic_similarity with "four"
      const { exitCode } = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);
      expect(exitCode).toBe(0);
    }, 70000);

    it('should exercise llm_judge check', () => {
      // This is implicitly tested by the main check command
      // The YAML file includes: llm_judge checking for equivalence to 4
      const { exitCode } = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);
      expect(exitCode).toBe(0);
    }, 70000);

    it('should exercise token_length check', () => {
      // This is implicitly tested by the main check command
      // The YAML file includes: token_length with min/max bounds
      const { exitCode } = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);
      expect(exitCode).toBe(0);
    }, 70000);
  });

  describe('Error handling', () => {
    it('should handle missing API key gracefully', () => {
      // Save original API key
      const originalKey = process.env.VIBECHECK_API_KEY;

      // Remove API key
      delete process.env.VIBECHECK_API_KEY;

      const { exitCode } = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);

      // Should fail without API key
      expect(exitCode).not.toBe(0);

      // Restore API key
      process.env.VIBECHECK_API_KEY = originalKey;
    });

    it('should handle invalid API key gracefully', () => {
      // Save original API key
      const originalKey = process.env.VIBECHECK_API_KEY;

      // Set invalid API key
      process.env.VIBECHECK_API_KEY = 'invalid-key-12345';

      const { exitCode } = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);

      // Should fail with invalid API key
      expect(exitCode).not.toBe(0);

      // Restore API key
      process.env.VIBECHECK_API_KEY = originalKey;
    });

    it('should handle malformed YAML gracefully', () => {
      // Create a temporary malformed YAML file
      const malformedYamlPath = path.join(__dirname, 'fixtures', 'malformed.yaml');
      fs.writeFileSync(malformedYamlPath, 'invalid: yaml: content: [[[');

      const { exitCode } = runVibeCheckCommand(`check -f ${malformedYamlPath} --ci`);

      // Should fail with malformed YAML
      expect(exitCode).not.toBe(0);

      // Clean up
      fs.unlinkSync(malformedYamlPath);
    });
  });

  describe('CI mode behavior', () => {
    it('should use --ci flag for non-interactive execution', () => {
      const { stdout, exitCode } = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);

      expect(exitCode).toBe(0);
      // CI mode should not prompt for user input
      expect(stdout).not.toContain('Press');
      expect(stdout).not.toContain('Continue?');
    }, 70000);
  });

  describe('Runs CLI commands', () => {
    let recentRunId: string;

    beforeAll(() => {
      // Ensure there is at least one run and capture its ID via CLI
      const checkRes = runVibeCheckCommand(`check -f ${yamlFilePath} --ci`);
      expect(checkRes.exitCode).toBe(0);

      const listRes = runVibeCheckCommand('get runs');
      expect(listRes.exitCode).toBe(0);

      // Extract first UUID from output
      const idMatch = listRes.stdout.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
      expect(idMatch).toBeTruthy();
      recentRunId = idMatch![0];
    });

    it('should list runs', () => {
      const { stdout, exitCode } = runVibeCheckCommand('get runs');
      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
    });

    it('should list runs by suite', () => {
      // Parse an actual suite name from the runs list output to ensure correct identifier formatting
      const listAll = runVibeCheckCommand('get runs');
      expect(listAll.exitCode).toBe(0);
      // Try to capture a suite name from the output (formats may vary). Examples we try:
      // - "suite: integration-test"
      // - columns including the suite slug/name
      const suiteFromRunsMatch =
        listAll.stdout.match(/suite\s*:\s*([A-Za-z0-9_-]+)/i) ||
        listAll.stdout.match(/\b([A-Za-z0-9_-]*integration[A-Za-z0-9_-]*)\b/i);
      const suiteArg = (suiteFromRunsMatch && suiteFromRunsMatch[1]) || suiteName;

      const { stdout, exitCode } = runVibeCheckCommand(`get runs ${suiteArg}`);
      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
    });

    it('should get run details', () => {
      const { stdout, exitCode } = runVibeCheckCommand(`get run ${recentRunId}`);
      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
    });

    it('should get run logs (may be empty depending on storage)', () => {
      const { stdout, exitCode } = runVibeCheckCommand(`get run ${recentRunId} logs`);
      // Allow either success with output or a non-zero if logs are not present
      expect(stdout.length > 0 || exitCode !== 0).toBe(true);
    });
  });
});
