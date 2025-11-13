import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { suppressConsole, configureAxiosForTests, createTempFile, cleanupTempFiles } from '../helpers/test-utils';
import { runCommand } from '../../packages/cli/src/commands/run';

describe('vibe check command - Multi-Model Execution', () => {
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

  describe('Multi-model execution', () => {
    it.skip('should run evaluation on multiple models', async () => {
      const validYaml = `metadata:
  name: multi-model-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'multi-model.yaml');

      // Mock multiple run starts
      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-model-1' })
        .post('/api/eval/run')
        .reply(200, { runId: 'run-model-2' })
        .post('/api/eval/run')
        .reply(200, { runId: 'run-model-3' });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      let exitCode: number | undefined;
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        exitCode = code;
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({
            file: tempFile,
            models: ['anthropic/claude-3-5-sonnet', 'openai/gpt-4o', 'anthropic/claude-3-haiku'],
            debug: false,
            neverPrompt: true
          });
        } catch (error: any) {
          // Error will be thrown due to exit mock
        }
      });

      // Should exit with 0 after starting all runs
      expect(exitCode).toBe(0);

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const output = logs.join('\n');
      expect(output).toMatch(/Running suite "multi-model-test" on 3 models/);
      expect(output).toMatch(/run-model-1/);
      expect(output).toMatch(/run-model-2/);
      expect(output).toMatch(/run-model-3/);

      consoleSpy.mockRestore();
      exitMock.mockRestore();
    });

    it.skip('should handle error for one model and continue with others', async () => {
      const validYaml = `metadata:
  name: partial-failure-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'partial-failure.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-success-1' })
        .post('/api/eval/run')
        .reply(200, { error: 'Model not available' })
        .post('/api/eval/run')
        .reply(200, { runId: 'run-success-2' });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      let exitCode: number | undefined;
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        exitCode = code;
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({
            file: tempFile,
            models: ['model-1', 'model-2', 'model-3'],
            debug: false,
            neverPrompt: true
          });
        } catch (error: any) {
          // Error will be thrown due to exit mock
        }
      });

      expect(exitCode).toBe(0);

      const errorLogs = consoleErrorSpy.mock.calls.map(call => call.join(' '));
      expect(errorLogs.some(log => log.includes('API Error for model'))).toBe(true);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      exitMock.mockRestore();
    });

    it.skip('should handle network error for one model and continue', async () => {
      const validYaml = `metadata:
  name: network-error-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'network-error.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-1' })
        .post('/api/eval/run')
        .replyWithError('Network error')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-3' });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      let exitCode: number | undefined;
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        exitCode = code;
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({
            file: tempFile,
            models: ['model-1', 'model-2', 'model-3'],
            debug: false,
            neverPrompt: true
          });
        } catch (error: any) {
          // Error will be thrown due to exit mock
        }
      });

      expect(exitCode).toBe(0);

      consoleErrorSpy.mockRestore();
      exitMock.mockRestore();
    });

    it.skip('should log debug info for multi-model runs', async () => {
      const validYaml = `metadata:
  name: debug-multi
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'debug-multi.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-1' })
        .post('/api/eval/run')
        .reply(200, { runId: 'run-2' });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      let exitCode: number | undefined;
      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        exitCode = code;
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({
            file: tempFile,
            models: ['model-1', 'model-2'],
            debug: true,
            neverPrompt: true
          });
        } catch (error: any) {
          // Error will be thrown due to exit mock
        }
      });

      expect(exitCode).toBe(0);

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const hasDebugLog = logs.some(log => log.includes('[DEBUG]') && log.includes('Starting run for model'));
      expect(hasDebugLog).toBe(true);

      consoleSpy.mockRestore();
      exitMock.mockRestore();
    });
  });

  describe('Single model with API error responses', () => {
    it('should handle API returning error object', async () => {
      const validYaml = `metadata:
  name: api-error-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'api-error.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { error: 'Invalid model configuration' });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle API returning error with message field', async () => {
      const validYaml = `metadata:
  name: error-msg-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'error-msg.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { error: { message: 'Detailed error message' } });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });

    it('should handle API returning error object without message', async () => {
      const validYaml = `metadata:
  name: error-obj-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'error-obj.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { error: { code: 500, details: 'Something went wrong' } });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      await suppressConsole(async () => {
        try {
          await runCommand({ file: tempFile, debug: false, neverPrompt: true });
        } catch (error: any) {
          expect(error.message).toContain('process.exit: 1');
        }
      });

      exitMock.mockRestore();
    });
  });

  describe('Debug mode with single model', () => {
    it('should log detailed debug info for request', async () => {
      const validYaml = `metadata:
  name: debug-single
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'debug-single.yaml');

      apiMock.mockRunEval();
      apiMock.mockStatusCompleted('test-run-id-123');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await runCommand({ file: tempFile, debug: true, neverPrompt: true });
      } catch (error: any) {
        // May complete
      }

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const output = logs.join('\n');
      expect(output).toMatch(/\[DEBUG\] Request to:/);
      expect(output).toMatch(/\[DEBUG\] Headers:/);
      expect(output).toMatch(/\[DEBUG\] Request payload:/);
      expect(output).toMatch(/\[DEBUG\] Response status:/);
      expect(output).toMatch(/\[DEBUG\] Response data:/);

      consoleSpy.mockRestore();
      exitMock.mockRestore();
    });

    it('should mask API key in debug output', async () => {
      const validYaml = `metadata:
  name: debug-masked
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'debug-masked.yaml');

      apiMock.mockRunEval();
      apiMock.mockStatusCompleted('test-run-id-123');

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await runCommand({ file: tempFile, debug: true, neverPrompt: true });
      } catch (error: any) {
        // May complete
      }

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      const output = logs.join('\n');
      // Should show masked key (first 10 chars + ...)
      expect(output).toMatch(/test-api-k\.\.\./);
      // Should NOT show full key
      expect(output).not.toMatch(new RegExp(testApiKey));

      consoleSpy.mockRestore();
      exitMock.mockRestore();
    });
  });
});
