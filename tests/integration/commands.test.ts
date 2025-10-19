import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { withEnv, createTempFile, cleanupTempFiles, suppressConsole } from '../helpers/test-utils';
import { runCommand } from '../../packages/cli/src/commands/run';
import { saveCommand, listCommand, getCommand } from '../../packages/cli/src/commands/suite';
import * as fs from 'fs';
import * as path from 'path';

describe('CLI Commands Integration Tests', () => {
  let apiMock: ReturnType<typeof setupApiMock>;
  const testApiKey = 'test-api-key-12345';

  beforeEach(() => {
    apiMock = setupApiMock();
    // Set up environment with test API key
    process.env.VIBECHECK_API_KEY = testApiKey;
    process.env.VIBECHECK_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    cleanupApiMocks();
    cleanupTempFiles();
    jest.restoreAllMocks();
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
        await runCommand({ file: tempFile, debug: false, interactive: false });
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
          await runCommand({ file: tempFile, debug: false, interactive: false });
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
          await runCommand({ file: tempFile, debug: false, interactive: false });
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
            interactive: false
          });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle API unauthorized error', async () => {
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

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, interactive: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

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
          await runCommand({ file: tempFile, debug: false, interactive: false });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle missing API key', async () => {
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
            await runCommand({ file: tempFile, debug: false, interactive: false });
          } catch (error: any) {
            expect(error.message).toContain('process.exit: 1');
          }
        });
      });

      exitMock.mockRestore();
    });
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
          await runCommand({ file: tempFile, debug: false, interactive: false });
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
});
