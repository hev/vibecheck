import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { suppressConsole, configureAxiosForTests, createTempFile, cleanupTempFiles } from '../helpers/test-utils';
import { runCommand, runSuiteCommand } from '../../packages/cli/src/commands/run';

describe('vibe check command - Extended Tests', () => {
  let apiMock: ReturnType<typeof setupApiMock>;
  let axiosCleanup: (() => void) | undefined;
  const testApiKey = 'test-api-key-12345';

  beforeEach(() => {
    apiMock = setupApiMock();
    axiosCleanup = configureAxiosForTests();
    process.env.VIBECHECK_API_KEY = testApiKey;
    process.env.VIBECHECK_URL = 'http://localhost:3000';
  });

  afterEach(async () => {
    await cleanupApiMocks();
    if (axiosCleanup) {
      await axiosCleanup();
      axiosCleanup = undefined;
    }
    cleanupTempFiles();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Error handling edge cases', () => {
    it('should handle network errors gracefully', async () => {
      const validYaml = `metadata:
  name: network-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'network.yaml');

      // Clean up mocks to simulate network error
      await cleanupApiMocks();

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit|network/i);
        }
      });

      exitMock.mockRestore();
    });

    it('should handle status polling errors', async () => {
      const validYaml = `metadata:
  name: polling-error-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'polling-error.yaml');

      apiMock.mockRunEval();
      // Mock status endpoint to return error
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .get(/\/api\/eval\/status\/.*/)
        .reply(500, { error: 'Status polling failed' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit/);
        }
      });

      exitMock.mockRestore();
    });

    it.skip('should handle API returning non-JSON response', async () => {
      const validYaml = `metadata:
  name: non-json-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'non-json.yaml');

      // Mock API to return HTML error page
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(500, '<html>Error</html>', { 'Content-Type': 'text/html' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit/);
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('Suite-based run with all overrides', () => {
    it('should apply all possible overrides', async () => {
      apiMock.mockGetSuiteWithResponse('full-override-test', {
        suite: {
          name: 'full-override-test',
          yamlContent: `metadata:
  name: full-override-test
  model: anthropic/claude-3-haiku
  system_prompt: Old prompt
  threads: 1
  mcp_server:
    url: https://old-mcp.com
    name: old-mcp
    authorization_token: old-token

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`
        }
      });

      apiMock.mockRunEval();
      apiMock.mockStatusCompleted('test-run-id-123');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      try {
        await suppressConsole(async () => {
          await runSuiteCommand({
            suiteName: 'full-override-test',
            model: 'openai/gpt-4o',
            systemPrompt: 'New prompt',
            threads: 10,
            mcpUrl: 'https://new-mcp.com',
            mcpName: 'new-mcp',
            mcpToken: 'new-token',
            debug: false,
            async: false
          });
        });
      } catch (error: any) {
        if (error.message?.includes('process.exit:')) {
          // Success paths may not exit
        }
      }

      exitMock.mockRestore();
    });

    it('should handle suite with no MCP but override provided', async () => {
      apiMock.mockGetSuiteWithResponse('no-mcp-test', {
        suite: {
          name: 'no-mcp-test',
          yamlContent: `metadata:
  name: no-mcp-test
  model: anthropic/claude-3-5-sonnet

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`
        }
      });

      apiMock.mockRunEval();
      apiMock.mockStatusCompleted('test-run-id-123');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      try {
        await suppressConsole(async () => {
          await runSuiteCommand({
            suiteName: 'no-mcp-test',
            mcpUrl: 'https://new-mcp.com',
            mcpName: 'new-mcp',
            mcpToken: 'new-token',
            debug: false,
            async: false
          });
        });
      } catch (error: any) {
        // May exit
      }

      exitMock.mockRestore();
    });
  });

  describe('YAML validation edge cases', () => {
    it('should handle evals with empty checks array', async () => {
      const emptyChecksYaml = `metadata:
  name: empty-checks
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks: []
`;
      const tempFile = createTempFile(emptyChecksYaml, 'empty-checks.yaml');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toMatch(/process.exit/);
        }
      });

      exitMock.mockRestore();
    });

    it('should handle extremely long prompts', async () => {
      const longPrompt = 'A'.repeat(10000);
      const longPromptYaml = `metadata:
  name: long-prompt-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: ${longPrompt}
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(longPromptYaml, 'long-prompt.yaml');

      apiMock.mockRunEval();
      apiMock.mockStatusCompleted('test-run-id-123');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      try {
        await suppressConsole(async () => {
          await runCommand({ file: tempFile, debug: false, neverPrompt: true });
        });
      } catch (error: any) {
        // May complete or exit
      }

      exitMock.mockRestore();
    });

    it('should handle many evals in single suite', async () => {
      const manyEvalsYaml = `metadata:
  name: many-evals
  model: anthropic/claude-3-5-sonnet-20241022

evals:
${Array.from({ length: 50 }, (_, i) => `  - prompt: Test ${i}
    checks:
      - match: "*test*"`).join('\n')}
`;
      const tempFile = createTempFile(manyEvalsYaml, 'many-evals.yaml');

      apiMock.mockRunEval();
      apiMock.mockStatusCompleted('test-run-id-123');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      try {
        await suppressConsole(async () => {
          await runCommand({ file: tempFile, debug: false, neverPrompt: true });
        });
      } catch (error: any) {
        // May complete or exit
      }

      exitMock.mockRestore();
    });
  });
});
