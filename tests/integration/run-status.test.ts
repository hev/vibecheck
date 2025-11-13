import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setupApiMock, cleanupApiMocks } from '../helpers/api-mocks';
import { suppressConsole, configureAxiosForTests, createTempFile, cleanupTempFiles } from '../helpers/test-utils';
import { runCommand } from '../../packages/cli/src/commands/run';

describe('vibe check command - Status Polling', () => {
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

  describe('Failed status handling', () => {
    it('should handle failed status with error message', async () => {
      const validYaml = `metadata:
  name: failed-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'failed.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-failed-123' })
        .get('/api/eval/status/run-failed-123')
        .reply(200, {
          status: 'failed',
          error: { message: 'Model execution failed' },
          results: [],
          totalTimeMs: 1000
        });

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

    it('should handle failed status without error details', async () => {
      const validYaml = `metadata:
  name: failed-no-msg
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'failed-no-msg.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-failed-456' })
        .get('/api/eval/status/run-failed-456')
        .reply(200, {
          status: 'failed',
          results: [],
          totalTimeMs: 1000
        });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await runCommand({ file: tempFile, debug: false, neverPrompt: true });
      } catch (error: any) {
        expect(error.message).toContain('process.exit: 1');
      }

      const errors = consoleErrorSpy.mock.calls.map(call => call.join(' '));
      expect(errors.some(msg => msg.includes('All evaluations failed'))).toBe(true);

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      exitMock.mockRestore();
    });
  });

  describe('Partial failure status handling', () => {
    it('should handle partial_failure with results', async () => {
      const validYaml = `metadata:
  name: partial-fail
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'partial-fail.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-partial-123' })
        .get('/api/eval/status/run-partial-123')
        .reply(200, {
          status: 'partial_failure',
          error: { message: 'Some evals failed to execute' },
          results: [
            {
              prompt: 'Test',
              response: 'test response',
              checkResults: [{ type: 'match', passed: true }],
              passed: true
            }
          ],
          totalTimeMs: 2000
        });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await runCommand({ file: tempFile, debug: false, neverPrompt: true });
      } catch (error: any) {
        expect(error.message).toContain('process.exit: 1');
      }

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      expect(logs.some(log => log.includes('Warning: Some evaluations failed'))).toBe(true);

      consoleSpy.mockRestore();
      exitMock.mockRestore();
    });

    it('should save output on partial failure', async () => {
      const validYaml = `metadata:
  name: partial-save
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'partial-save.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-partial-save' })
        .get('/api/eval/status/run-partial-save')
        .reply(200, {
          status: 'partial_failure',
          results: [
            {
              prompt: 'Test',
              response: 'test response',
              checkResults: [{ type: 'match', passed: true }],
              passed: true
            }
          ],
          totalTimeMs: 1500
        });

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

  describe('Timed out status handling', () => {
    it('should handle timed_out status with results', async () => {
      const validYaml = `metadata:
  name: timeout-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'timeout.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-timeout-123' })
        .get('/api/eval/status/run-timeout-123')
        .reply(200, {
          status: 'timed_out',
          error: { message: 'Exceeded maximum execution time' },
          results: [
            {
              prompt: 'Test',
              response: 'partial response',
              checkResults: [{ type: 'match', passed: true }],
              passed: true
            }
          ],
          totalTimeMs: 300000
        });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await runCommand({ file: tempFile, debug: false, neverPrompt: true });
      } catch (error: any) {
        expect(error.message).toContain('process.exit: 1');
      }

      const logs = consoleSpy.mock.calls.map(call => call.join(' '));
      expect(logs.some(log => log.includes('Evaluation suite timed out'))).toBe(true);

      consoleSpy.mockRestore();
      exitMock.mockRestore();
    });

    it('should save output on timeout', async () => {
      const validYaml = `metadata:
  name: timeout-save
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'timeout-save.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-timeout-save' })
        .get('/api/eval/status/run-timeout-save')
        .reply(200, {
          status: 'timed_out',
          results: [],
          totalTimeMs: 300000
        });

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

  describe('Error status handling', () => {
    it('should handle error status with message', async () => {
      const validYaml = `metadata:
  name: error-test
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'error.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-error-123' })
        .get('/api/eval/status/run-error-123')
        .reply(200, {
          status: 'error',
          error: { message: 'Internal server error' },
          results: [],
          totalTimeMs: 500
        });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await runCommand({ file: tempFile, debug: false, neverPrompt: true });
      } catch (error: any) {
        expect(error.message).toContain('process.exit: 1');
      }

      const errors = consoleErrorSpy.mock.calls.map(call => call.join(' '));
      expect(errors.some(msg => msg.includes('Internal server error'))).toBe(true);

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      exitMock.mockRestore();
    });

    it('should handle error status without details', async () => {
      const validYaml = `metadata:
  name: error-no-msg
  model: anthropic/claude-3-5-sonnet-20241022

evals:
  - prompt: Test
    checks:
      - match: "*test*"
`;
      const tempFile = createTempFile(validYaml, 'error-no-msg.yaml');

      const nock = require('nock');
      nock(process.env.VIBECHECK_URL || 'http://localhost:3000')
        .post('/api/eval/run')
        .reply(200, { runId: 'run-error-456' })
        .get('/api/eval/status/run-error-456')
        .reply(200, {
          status: 'error',
          results: [],
          totalTimeMs: 500
        });

      const exitMock = jest.spyOn(process, 'exit').mockImplementation((code?: any) => {
        throw new Error(`process.exit: ${code}`);
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await runCommand({ file: tempFile, debug: false, neverPrompt: true });
      } catch (error: any) {
        expect(error.message).toContain('process.exit: 1');
      }

      const errors = consoleErrorSpy.mock.calls.map(call => call.join(' '));
      expect(errors.some(msg => msg.includes('Vibe check failed'))).toBe(true);

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      exitMock.mockRestore();
    });
  });
});
