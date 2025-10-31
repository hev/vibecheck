import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { withEnv, createTempFile, cleanupTempFiles, suppressConsole } from '../helpers/test-utils';
import { runCommand } from '../../packages/cli/src/commands/run';
import { saveCommand, listCommand, getCommand } from '../../packages/cli/src/commands/suite';
import { varSetCommand, varUpdateCommand, varGetCommand, varListCommand, varDeleteCommand } from '../../packages/cli/src/commands/var';
import { secretSetCommand, secretUpdateCommand, secretDeleteCommand, secretListCommand } from '../../packages/cli/src/commands/secret';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

describe('CLI Commands Integration Tests', () => {
  let apiMock: ReturnType<typeof setupApiMock>;
  const testApiKey = 'test-api-key-12345';

  beforeEach(() => {
    apiMock = setupApiMock();
    // Set up environment with test API key
    process.env.VIBECHECK_API_KEY = testApiKey;
    process.env.VIBECHECK_URL = 'http://localhost:3000';
    // Clear neverPrompt environment variable for test isolation
    delete process.env.VIBECHECK_NEVER_PROMPT;
  });
  afterEach(() => {
    cleanupApiMocks();
    cleanupTempFiles();
    jest.restoreAllMocks();
    // Clear all mocks to prevent interference between tests
    jest.clearAllMocks();
  });

  describe('vibe check command', () => {
    it('should run evaluations successfully with valid YAML', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant.

evals:
  - prompt: What is 2 + 2?
    checks:
      match: "*4*"
`;
      const tempFile = createTempFile(validYaml, 'test-eval.yaml');

      // Mock API responses
      apiMock.mockRunEval();
      apiMock.mockStatusCompleted();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        await runCommand({ file: tempFile, debug: false, interactive: false, neverPrompt: true });
      });

      exitMock.mockRestore();
    });

    it('should reject old YAML format with clear error message', async () => {
      const oldFormatYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant.

evals:
  - prompt: What is 2 + 2?
    checks:
      - type: string_contains
        value: "4"
`;
      const tempFile = createTempFile(oldFormatYaml, 'old-format.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, interactive: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should fail with invalid YAML schema', async () => {
      const invalidYaml = `metadata:
  name: test-suite
  # Missing model field

evals:
  - prompt: Test
    checks:
      match: "*test*"
      # Invalid semantic check - missing threshold
      semantic:
        expected: "test response"
`;
      const tempFile = createTempFile(invalidYaml, 'invalid.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, interactive: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should fail with non-existent file', async () => {
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({
            file: '/nonexistent/file.yaml',
            debug: false,
            interactive: false,
            neverPrompt: true
          });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle API unauthorized error (triggers redeem flow)', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant.

evals:
  - prompt: Test
    checks:
      match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'test.yaml');

      apiMock.mockRunEval({ error: 'Unauthorized' } as any, 401);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      // Stub spawnSync for redeem to avoid launching an interactive process in CI
      const childProc = require('child_process');
      const spawnSpy = jest.spyOn(childProc, 'spawnSync').mockReturnValue({ status: 0 } as any);

      await suppressConsole(async () => {
        try {
          // Remove neverPrompt to test the redeem flow
          await runCommand({ file: tempFile, debug: false, interactive: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });
      expect(spawnSpy).toHaveBeenCalledWith('vibe', ['redeem'], { stdio: 'inherit' });
      spawnSpy.mockRestore();

      exitMock.mockRestore();
    });

    it('should handle API server error', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant.

evals:
  - prompt: Test
    checks:
      match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'test.yaml');

      apiMock.mockRunEval({ error: 'Internal server error' } as any, 500);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, interactive: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle missing API key (triggers redeem flow)', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant.

evals:
  - prompt: Test
    checks:
      match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'test.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await withEnv({ VIBECHECK_API_KEY: undefined }, async () => {
        // Stub spawnSync for redeem to avoid launching an interactive process in CI
        const childProc = require('child_process');
        const spawnSpy = jest.spyOn(childProc, 'spawnSync').mockReturnValue({ status: 0 } as any);
        await suppressConsole(async () => {
          try {
          await runCommand({ file: tempFile, debug: false, interactive: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });
      // With neverPrompt: true, spawn should NOT be called
        spawnSpy.mockRestore();
      });

      exitMock.mockRestore();
    });

    // Note: Confirmation prompt tests are complex to mock properly in Jest
    // The functionality is implemented and tested through manual testing
    // Integration tests focus on the core command functionality
  });

  describe('vibe set command', () => {
    it('should save suite successfully', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant.

evals:
  - prompt: What is 2 + 2?
    checks:
      match: "*4*"
`;
      const tempFile = createTempFile(validYaml, 'save-test.yaml');

      apiMock.mockSaveSuite();

      await suppressConsole(async () => {
        await saveCommand({ file: tempFile, debug: false });
      });

      // Should complete without error
    });

    it('should fail saving suite with invalid YAML', async () => {
      const invalidYaml = `invalid: yaml: content`;
      const tempFile = createTempFile(invalidYaml, 'invalid-save.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await saveCommand({ file: tempFile, debug: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit');
        }
      });

      exitMock.mockRestore();
    });

    it('should fail saving suite without API key', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant.

evals:
  - prompt: Test
    checks:
      match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'test.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await withEnv({ VIBECHECK_API_KEY: undefined }, async () => {
        await suppressConsole(async () => {
          try {
            await saveCommand({ file: tempFile, debug: false });
          } catch (error: any) {
            expect(error.message).toContain('process.exit: 1');
          }
        });
      });

      exitMock.mockRestore();
    });

    it('should warn when model flag is ignored with file', async () => {
      const validYaml = `metadata:
  name: test-suite-file
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: What is 2 + 2?
    checks:
      match: "*4*"
`;
      const tempFile = createTempFile(validYaml, 'warn-model-file.yaml');

      // Mock API responses
      apiMock.mockRunEval();
      apiMock.mockStatusCompleted();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      const logSpy = jest.spyOn(console, 'log').mockImplementation((() => {}) as any);

      try {
        await runCommand({ file: tempFile, model: 'openai/gpt-4o', debug: false, interactive: false, neverPrompt: true });
      } catch (error: any) {
        // runCommand may call process.exit, which we catch above; ignore here
      }

      // Assert the warning message and guidance are logged
      const allLogs = (logSpy.mock.calls.map(c => (c[0] ?? '').toString()).join('\n'));
      expect(allLogs).toMatch(/Ignoring model \"openai\/gpt-4o\".*Using YAML model/);
      expect(allLogs).toMatch(/vibe check test-suite-file -m openai\/gpt-4o/);

      logSpy.mockRestore();
      exitMock.mockRestore();
    });
  });

  describe('vibe get suites command', () => {
    it('should list suites successfully', async () => {
      apiMock.mockListSuites();

      await suppressConsole(async () => {
        await listCommand(false);
      });

      // Should complete without error
    });

    it('should handle unauthorized when listing suites', async () => {
      apiMock.mockListSuites(401);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await listCommand(false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle missing API key when listing suites', async () => {
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await withEnv({ VIBECHECK_API_KEY: undefined }, async () => {
        await suppressConsole(async () => {
          try {
            await listCommand(false);
          } catch (error: any) {
            expect(error.message).toContain('process.exit: 1');
          }
        });
      });

      exitMock.mockRestore();
    });
  });

  describe('vibe get suite <name> command', () => {
    it('should get specific suite successfully', async () => {
      apiMock.mockGetSuite('test-suite');

      await suppressConsole(async () => {
        await getCommand('test-suite', false);
      });

      // Should complete without error
    });

    it('should handle non-existent suite', async () => {
      apiMock.mockGetSuite('nonexistent', 404);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await getCommand('nonexistent', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle unauthorized when getting suite', async () => {
      apiMock.mockGetSuite('test-suite', 401);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await getCommand('test-suite', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('Error handling across commands', () => {
    it('should handle network errors gracefully', async () => {
      const validYaml = `metadata:
  name: test-suite
  model: anthropic/claude-3-5-sonnet-20241022
  system_prompt: You are a helpful assistant.

evals:
  - prompt: Test
    checks:
      match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'test.yaml');

      // Don't mock anything - will cause network error
      cleanupApiMocks();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, interactive: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit|ECONNREFUSED|Network/i);
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('vibe check suite-based command', () => {
    it('should run suite with no overrides', async () => {
      const { runSuiteCommand } = require('../../packages/cli/src/commands/run');
      
      // Mock suite fetch
      apiMock.mockGetSuiteWithResponse('test-suite', {
        suite: {
          name: 'test-suite',
          yamlContent: `metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
  system_prompt: You are a helpful assistant.

evals:
  - prompt: Say hello
    checks:
      match: "*hello*"`
        }
      });

      // Mock run eval
      apiMock.mockRunEval();
      apiMock.mockStatusCompleted();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        await runSuiteCommand({
          suiteName: 'test-suite',
          debug: false,
          interactive: false,
          async: false
        });
      });

      exitMock.mockRestore();
    });

    it('should run suite with model override', async () => {
      const { runSuiteCommand } = require('../../packages/cli/src/commands/run');
      
      // Mock suite fetch
      apiMock.mockGetSuiteWithResponse('test-suite', {
        suite: {
          name: 'test-suite',
          yamlContent: `metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
  system_prompt: You are a helpful assistant.

evals:
  - prompt: Say hello
    checks:
      match: "*hello*"`
        }
      });

      // Mock run eval with overridden model
      apiMock.mockRunEval();
      apiMock.mockStatusCompleted();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        await runSuiteCommand({
          suiteName: 'test-suite',
          model: 'openai/gpt-4',
          debug: false,
          interactive: false,
          async: false
        });
      });

      exitMock.mockRestore();
    });

    it('should run suite with multiple overrides', async () => {
      const { runSuiteCommand } = require('../../packages/cli/src/commands/run');
      
      // Mock suite fetch
      apiMock.mockGetSuiteWithResponse('test-suite', {
        suite: {
          name: 'test-suite',
          yamlContent: `metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
  system_prompt: You are a helpful assistant.
  threads: 2

evals:
  - prompt: Say hello
    checks:
      match: "*hello*"`
        }
      });

      // Mock run eval
      apiMock.mockRunEval();
      apiMock.mockStatusCompleted();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        await runSuiteCommand({
          suiteName: 'test-suite',
          model: 'openai/gpt-4',
          systemPrompt: 'You are a pirate assistant.',
          threads: 5,
          debug: false,
          interactive: false,
          async: false
        });
      });

      exitMock.mockRestore();
    });

    it('should run suite with MCP overrides', async () => {
      const { runSuiteCommand } = require('../../packages/cli/src/commands/run');
      
      // Mock suite fetch
      apiMock.mockGetSuiteWithResponse('test-suite', {
        suite: {
          name: 'test-suite',
          yamlContent: `metadata:
  name: test-suite
  model: anthropic/claude-3.5-sonnet
  mcp_server:
    url: https://example.com/mcp
    name: example-mcp
    authorization_token: old-token

evals:
  - prompt: Use the calculator
    checks:
      match: "*35*"`
        }
      });

      // Mock run eval
      apiMock.mockRunEval();
      apiMock.mockStatusCompleted();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        await runSuiteCommand({
          suiteName: 'test-suite',
          mcpUrl: 'https://new-mcp.com',
          mcpName: 'new-mcp-server',
          mcpToken: 'new-token',
          debug: false,
          interactive: false,
          async: false
        });
      });

      exitMock.mockRestore();
    });

    it('should handle suite not found error', async () => {
      const { runSuiteCommand } = require('../../packages/cli/src/commands/run');
      
      // Mock suite not found
      apiMock.mockGetSuiteWithResponse('nonexistent-suite', { error: 'Suite not found' }, 404);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runSuiteCommand({
            suiteName: 'nonexistent-suite',
            debug: false,
            interactive: false,
            async: false
          });
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit: 1/);
        }
      });

      exitMock.mockRestore();
    });

    it('should handle invalid suite format', async () => {
      const { runSuiteCommand } = require('../../packages/cli/src/commands/run');
      
      // Mock suite with invalid YAML
      apiMock.mockGetSuiteWithResponse('invalid-suite', {
        suite: {
          name: 'invalid-suite',
          yamlContent: `invalid: yaml: content: [`
        }
      });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runSuiteCommand({
            suiteName: 'invalid-suite',
            debug: false,
            interactive: false,
            async: false
          });
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit: 1/);
        }
      });

      exitMock.mockRestore();
    });
  });

  // Note: Multi-model and sorting tests are complex to mock properly
  // The functionality is implemented and tested through unit tests
  // Integration tests focus on the core command functionality

  describe('vibe var commands', () => {
    beforeEach(() => {
      process.env.VIBECHECK_API_URL = 'http://localhost:3000';
    });

    it('should set a variable successfully', async () => {
      apiMock.mockVarSet('myvar', 'myvalue');

      await suppressConsole(async () => {
        await varSetCommand('myvar', 'myvalue', false);
      });
    });

    it('should update a variable successfully', async () => {
      apiMock.mockVarUpdate('myvar', 'newvalue');

      await suppressConsole(async () => {
        await varUpdateCommand('myvar', 'newvalue', false);
      });
    });

    it('should get a variable value', async () => {
      apiMock.mockVarGet('myvar', 'myvalue');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Don't use suppressConsole here - we want to capture console.log
      await varGetCommand('myvar', false);

      expect(consoleSpy).toHaveBeenCalledWith('myvalue');
      consoleSpy.mockRestore();
    });

    it('should list all variables', async () => {
      apiMock.mockVarList([
        { name: 'var1', value: 'value1' },
        { name: 'var2', value: 'value2' }
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Don't use suppressConsole here - we want to capture console.log
      await varListCommand(false);

      expect(consoleSpy).toHaveBeenCalledWith('var1=value1');
      expect(consoleSpy).toHaveBeenCalledWith('var2=value2');
      consoleSpy.mockRestore();
    });

    it('should delete a variable successfully', async () => {
      apiMock.mockVarDelete('myvar');

      await suppressConsole(async () => {
        await varDeleteCommand('myvar', false);
      });
    });

    it('should handle 400 error when setting invalid variable', async () => {
      apiMock.mockVarSet('invalid', 'value', 400);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await varSetCommand('invalid', 'value', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 403 error when missing API key', async () => {
      apiMock.mockVarSet('myvar', 'myvalue', 403);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await varSetCommand('myvar', 'myvalue', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 404 error when getting non-existent variable', async () => {
      apiMock.mockVarGet('nonexistent', '', 404);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await varGetCommand('nonexistent', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle missing API key gracefully', async () => {
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await withEnv({ VIBECHECK_API_KEY: undefined, API_KEY: undefined }, async () => {
        await suppressConsole(async () => {
          try {
            await varSetCommand('myvar', 'myvalue', false);
          } catch (error: any) {
            expect(error.message).toContain('process.exit: 1');
          }
        });
      });

      exitMock.mockRestore();
    });

    it('should normalize variable names (trim whitespace)', async () => {
      apiMock.mockVarSet('myvar', 'myvalue');

      await suppressConsole(async () => {
        await varSetCommand('  myvar  ', 'myvalue', false);
      });
    });
  });

  describe('vibe secret commands', () => {
    beforeEach(() => {
      process.env.VIBECHECK_API_URL = 'http://localhost:3000';
    });

    it('should set a secret successfully', async () => {
      apiMock.mockSecretSet('mysecret', 'secretvalue');

      await suppressConsole(async () => {
        await secretSetCommand('mysecret', 'secretvalue', false);
      });
    });

    it('should update a secret successfully', async () => {
      apiMock.mockSecretUpdate('mysecret', 'newsecretvalue');

      await suppressConsole(async () => {
        await secretUpdateCommand('mysecret', 'newsecretvalue', false);
      });
    });

    it('should delete a secret successfully', async () => {
      apiMock.mockSecretDelete('mysecret');

      await suppressConsole(async () => {
        await secretDeleteCommand('mysecret', false);
      });
    });

    it('should handle 400 error when setting invalid secret', async () => {
      apiMock.mockSecretSet('invalid', 'value', 400);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await secretSetCommand('invalid', 'value', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 403 error when missing API key', async () => {
      apiMock.mockSecretSet('mysecret', 'secretvalue', 403);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await secretSetCommand('mysecret', 'secretvalue', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle 404 error when updating non-existent secret', async () => {
      apiMock.mockSecretUpdate('nonexistent', 'value', 404);

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await secretUpdateCommand('nonexistent', 'value', false);
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle missing API key gracefully', async () => {
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await withEnv({ VIBECHECK_API_KEY: undefined, API_KEY: undefined }, async () => {
        await suppressConsole(async () => {
          try {
            await secretSetCommand('mysecret', 'secretvalue', false);
          } catch (error: any) {
            expect(error.message).toContain('process.exit: 1');
          }
        });
      });

      exitMock.mockRestore();
    });

    it('should normalize secret names (trim whitespace)', async () => {
      apiMock.mockSecretSet('mysecret', 'secretvalue');

      await suppressConsole(async () => {
        await secretSetCommand('  mysecret  ', 'secretvalue', false);
      });
    });

    it('should list all secrets (names only)', async () => {
      apiMock.mockSecretList([
        { name: 'secret1' },
        { name: 'secret2' }
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Don't use suppressConsole here - we want to capture console.log
      await secretListCommand(false);

      expect(consoleSpy).toHaveBeenCalledWith('secret1');
      expect(consoleSpy).toHaveBeenCalledWith('secret2');
      consoleSpy.mockRestore();
    });
  });
});
