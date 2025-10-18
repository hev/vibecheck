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
});
